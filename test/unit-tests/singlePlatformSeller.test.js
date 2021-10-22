import 'regenerator-runtime/runtime';
import * as matchers from 'jest-extended';
import path from "path";
import {
    init,
    emulator,
    shallPass,
    sendTransaction,
    shallRevert,
    shallResolve,
    executeScript,
    shallThrow,
} from "flow-js-testing";
import { getTransactionEventName, initializePlatformAccount, deployNftContract, getTransactionEventData } from '../testHelpers';

expect.extend(matchers);

const platformAccountName = "PlatformAccount";
const TheMoonNFTContract = "TheMoonNFTContract";

let platformAccount;

const initialize = async () => {
    const basePath = path.resolve(__dirname, "../../cadence");
    const port = 8080;

    await init(basePath, {port});
    await emulator.start(port);

    platformAccount = await initializePlatformAccount(platformAccountName);
    await deployNftContract(platformAccount, TheMoonNFTContract);
}

const shutDown = async () => {
    return await emulator.stop();
}

describe('SinglePlatformSeller resource and SellerCatalog interface', () => {
    describe('SinglePlatformSeller resource methods (Methods not implemented from SellerCatalog)', () => {
        beforeEach(initialize);
        afterEach(shutDown);

        describe('depositNft() method', () => {
            it('Successfully able to deposit a MoonNft', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let inputData = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )

                            let nft <- self.minterRef.mintNFT(inputData)

                            self.platformSeller.depositNft( <- nft)

                        }
                    }
                `;

                await shallPass(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });
        });

        describe('depositRelease() method', () => {
            it('Successfully able to deposit a MoonNftRelease', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let inputData : [TheMoonNFTContract.MoonNftData] = []
                            inputData.append(
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            inputData.append(
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator2",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            let nfts <- self.minterRef.bulkMintNfts(inputData)


                            let packData = TheMoonNFTContract.MoonNftPackData(
                                0,
                                [],
                                "url",
                                title: "packTitle",
                                creator: "packCreator",
                                creatorId: 1
                            )

                            let mappingOfNfts <- {
                                "pack1UUID" : <- nfts
                            }
                            let packRelease <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts, packData, price: 20)

                            self.platformSeller.depositRelease( <- packRelease)

                        }
                    }
                `;

                await shallPass(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });
        });

        describe('bulkDepositNft() method', () => {
            it('Successfully able to bulk deposit a collection of MoonNfts', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let inputData1 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            let inputData2 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(inputData1)
                            let nft2 <- self.minterRef.mintNFT(inputData2)

                            self.platformSeller.bulkDepositNft(<- [<- nft1, <- nft2])

                        }
                    }
                `;

                await shallPass(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });

            it('Fails to bulk deposit an empty collection of MoonNfts', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            self.platformSeller.bulkDepositNft(<- [])

                        }
                    }
                `;

                await shallRevert(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });
        });

        describe('bulkDepositRelease() method', () => {
            it('Successfully able to bulk deposit a collection of MoonNftReleases', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let inputData1 : [TheMoonNFTContract.MoonNftData] = [
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                ),
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]
                            let inputData2 : [TheMoonNFTContract.MoonNftData] = [
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                                ),
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                                )
                            ]

                            let nfts1 <- self.minterRef.bulkMintNfts(inputData1)
                            let nfts2 <- self.minterRef.bulkMintNfts(inputData1)


                            let packData1 = TheMoonNFTContract.MoonNftPackData(
                                0,
                                [],
                                "url",
                                title: "packTitle",
                                creator: "testCreator1",
                                creatorId: 1
                            )
                            let packData2 = TheMoonNFTContract.MoonNftPackData(
                                0,
                                [],
                                "url",
                                title: "packTitle",
                                creator: "testCreator2",
                                creatorId: 2
                            )

                            let mappingOfNfts1 <- {
                                "pack1UUID" : <- nfts1
                            }
                            let mappingOfNfts2 <- {
                                "pack2UUID" : <- nfts2
                            }

                            let packRelease1 <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts1, packData1, price: 20)
                            let packRelease2 <- self.minterRef.createNftPackRelease(id: "release2", <- mappingOfNfts2, packData2, price: 20)

                            self.platformSeller.bulkDepositRelease( <- [<- packRelease1, <- packRelease2])

                        }
                    }
                `;

                await shallPass(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });

            fit('Fails to bulk deposit an empty collection of MoonNftReleases', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            self.platformSeller.bulkDepositRelease( <- [])

                        }
                    }
                `;

                await shallRevert(
                    sendTransaction({ code, signers: [platformAccount]})
                );
            });
        });
    });

    describe('SellerCatalog interface methods', () => {

    });
});
