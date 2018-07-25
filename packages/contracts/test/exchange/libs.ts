import { BlockchainLifecycle } from '@0xproject/dev-utils';
import { assetDataUtils, EIP712Utils, orderHashUtils } from '@0xproject/order-utils';
import { SignedOrder } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import * as chai from 'chai';

import { TestConstantsContract } from '../../generated_contract_wrappers/test_constants';
import { TestLibsContract } from '../../generated_contract_wrappers/test_libs';
import { addressUtils } from '../utils/address_utils';
import { artifacts } from '../utils/artifacts';
import { chaiSetup } from '../utils/chai_setup';
import { constants } from '../utils/constants';
import { OrderFactory } from '../utils/order_factory';
import { provider, txDefaults, web3Wrapper } from '../utils/web3_wrapper';

chaiSetup.configure();
const expect = chai.expect;

const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);

describe('Exchange libs', () => {
    let signedOrder: SignedOrder;
    let orderFactory: OrderFactory;
    let libs: TestLibsContract;
    let testConstants: TestConstantsContract;

    before(async () => {
        await blockchainLifecycle.startAsync();
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        const makerAddress = accounts[0];
        libs = await TestLibsContract.deployFrom0xArtifactAsync(artifacts.TestLibs, provider, txDefaults);
        testConstants = await TestConstantsContract.deployFrom0xArtifactAsync(
            artifacts.TestConstants,
            provider,
            txDefaults,
        );

        const defaultOrderParams = {
            ...constants.STATIC_ORDER_PARAMS,
            exchangeAddress: libs.address,
            makerAddress,
            feeRecipientAddress: addressUtils.generatePseudoRandomAddress(),
            makerAssetData: assetDataUtils.encodeERC20AssetData(addressUtils.generatePseudoRandomAddress()),
            takerAssetData: assetDataUtils.encodeERC20AssetData(addressUtils.generatePseudoRandomAddress()),
        };
        const privateKey = constants.TESTRPC_PRIVATE_KEYS[accounts.indexOf(makerAddress)];
        orderFactory = new OrderFactory(privateKey, defaultOrderParams);
    });

    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });

    describe('LibConstants', () => {
        describe('ZRX_ASSET_DATA', () => {
            it('should have the correct ZRX_ASSET_DATA', async () => {
                const isValid = await testConstants.assertValidZrxAssetData.callAsync();
                expect(isValid).to.be.equal(true);
            });
        });
    });

    describe('LibOrder', () => {
        describe('getOrderSchema', () => {
            it('should output the correct order schema hash', async () => {
                const orderSchema = await libs.getOrderSchemaHash.callAsync();
                const schemaHashBuffer = orderHashUtils._getOrderSchemaBuffer();
                const schemaHashHex = `0x${schemaHashBuffer.toString('hex')}`;
                expect(schemaHashHex).to.be.equal(orderSchema);
            });
        });
        describe('getDomainSeparatorSchema', () => {
            it('should output the correct domain separator schema hash', async () => {
                const domainSeparatorSchema = await libs.getDomainSeparatorSchemaHash.callAsync();
                const domainSchemaBuffer = EIP712Utils._getDomainSeparatorSchemaBuffer();
                const schemaHashHex = `0x${domainSchemaBuffer.toString('hex')}`;
                expect(schemaHashHex).to.be.equal(domainSeparatorSchema);
            });
        });
        describe('getOrderHash', () => {
            it('should output the correct orderHash', async () => {
                signedOrder = await orderFactory.newSignedOrderAsync();
                const orderHashHex = await libs.publicGetOrderHash.callAsync(signedOrder);
                expect(orderHashUtils.getOrderHashHex(signedOrder)).to.be.equal(orderHashHex);
            });
        });
    });

    describe('LibMath', () => {
        describe('isRoundingError', () => {
            it('should return false if there is a rounding error of 0.1%', async () => {
                const numerator = new BigNumber(20);
                const denominator = new BigNumber(999);
                const target = new BigNumber(50);
                // rounding error = ((20*50/999) - floor(20*50/999)) / (20*50/999) = 0.1%
                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.false();
            });

            it('should return false if there is a rounding of 0.09%', async () => {
                const numerator = new BigNumber(20);
                const denominator = new BigNumber(9991);
                const target = new BigNumber(500);
                // rounding error = ((20*500/9991) - floor(20*500/9991)) / (20*500/9991) = 0.09%
                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.false();
            });

            it('should return true if there is a rounding error of 0.11%', async () => {
                const numerator = new BigNumber(20);
                const denominator = new BigNumber(9989);
                const target = new BigNumber(500);
                // rounding error = ((20*500/9989) - floor(20*500/9989)) / (20*500/9989) = 0.011%
                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.true();
            });

            it('should return true if there is a rounding error > 0.1%', async () => {
                const numerator = new BigNumber(3);
                const denominator = new BigNumber(7);
                const target = new BigNumber(10);
                // rounding error = ((3*10/7) - floor(3*10/7)) / (3*10/7) = 6.67%
                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.true();
            });

            it('should return false when there is no rounding error', async () => {
                const numerator = new BigNumber(1);
                const denominator = new BigNumber(2);
                const target = new BigNumber(10);

                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.false();
            });

            it('should return false when there is rounding error <= 0.1%', async () => {
                // randomly generated numbers
                const numerator = new BigNumber(76564);
                const denominator = new BigNumber(676373677);
                const target = new BigNumber(105762562);
                // rounding error = ((76564*105762562/676373677) - floor(76564*105762562/676373677)) /
                // (76564*105762562/676373677) = 0.0007%
                const isRoundingError = await libs.publicIsRoundingError.callAsync(numerator, denominator, target);
                expect(isRoundingError).to.be.false();
            });
        });

        describe('getPartialAmount', () => {
            it('should return the numerator/denominator*target', async () => {
                const numerator = new BigNumber(1);
                const denominator = new BigNumber(2);
                const target = new BigNumber(10);

                const partialAmount = await libs.publicGetPartialAmount.callAsync(numerator, denominator, target);
                const expectedPartialAmount = 5;
                expect(partialAmount).to.be.bignumber.equal(expectedPartialAmount);
            });

            it('should round down', async () => {
                const numerator = new BigNumber(2);
                const denominator = new BigNumber(3);
                const target = new BigNumber(10);

                const partialAmount = await libs.publicGetPartialAmount.callAsync(numerator, denominator, target);
                const expectedPartialAmount = 6;
                expect(partialAmount).to.be.bignumber.equal(expectedPartialAmount);
            });

            it('should round .5 down', async () => {
                const numerator = new BigNumber(1);
                const denominator = new BigNumber(20);
                const target = new BigNumber(10);

                const partialAmount = await libs.publicGetPartialAmount.callAsync(numerator, denominator, target);
                const expectedPartialAmount = 0;
                expect(partialAmount).to.be.bignumber.equal(expectedPartialAmount);
            });
        });
    });
});
