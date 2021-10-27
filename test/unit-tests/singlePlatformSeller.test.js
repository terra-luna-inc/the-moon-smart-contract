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

jest.setTimeout(20000);
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
                            let nfts2 <- self.minterRef.bulkMintNfts(inputData2)


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

            it('Fails to bulk deposit an empty collection of MoonNftReleases', async () => {
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

        describe('withdrawRelease() method', () => {
            const depositRelease = async () => {
                const releaseId = "release1";
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
                            let packRelease <- self.minterRef.createNftPackRelease(id: "${releaseId}", <- mappingOfNfts, packData, price: 20)

                            self.platformSeller.depositRelease( <- packRelease)

                        }
                    }
                `;

                await sendTransaction({ code, signers: [platformAccount]});

                return releaseId;
            };

            it('Able to withdraw a release that exists', async () => {
                const releaseId = await depositRelease();

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let release <- self.platformSeller.withdrawRelease(id: releaseId)

                            destroy release
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [releaseId]})
                );

                const relevantEvents = getTransactionEventData(result, "SellerCatalog_ReleaseWithdrawn");
                expect(relevantEvents).toBeArrayOfSize(1);
            });

            it('Unable to withdraw a release that does not exist', async () => {
                const releaseId = "releaseId_That_Doesnt_Exits"

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let release <- self.platformSeller.withdrawRelease(id: releaseId)

                            destroy release
                        }
                    }
                `;

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: [releaseId]})
                );
            });
        });

        describe('withdrawNft() method', () => {
            const depositNft = async () => {
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

                const result = await sendTransaction({ code, signers: [platformAccount]});

                const relevantEvents = getTransactionEventData(result, "SellerCatalog_NftDeposited");

                return relevantEvents[0].id;
            };

            it('Able to withdraw an Nft that exists', async () => {
                const nftId = await depositNft();

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(nftId: UInt64) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let nft <- self.platformSeller.withdrawNft(id: nftId)

                            destroy nft
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [nftId]})
                );

                const relevantEvents = getTransactionEventData(result, "SellerCatalog_NftWithdrawn");
                expect(relevantEvents).toBeArrayOfSize(1);
            });

            it('Unable to withdraw an Nft that does not exist', async () => {
                await depositNft();
                const nftId = 10000

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(nftId: UInt64) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let nft <- self.platformSeller.withdrawNft(id: nftId)

                            destroy nft
                        }
                    }
                `;

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: [nftId]})
                );
            });
        });

        describe('withdrawPackFromWithinRelease() method', () => {
            const depositRelease = async () => {
                const releaseId = "release1";
                const packId1 = "pack1UUID";
                const packId2 = "pack2UUID";

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
                            let inputData1 = [
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
                            let inputData2 = [
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator2",
                                    creatorId: 1,
                                    metadata: {}
                                ),
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator2",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]

                            let nfts1 <- self.minterRef.bulkMintNfts(inputData1)
                            let nfts2 <- self.minterRef.bulkMintNfts(inputData2)

                            let packData = TheMoonNFTContract.MoonNftPackData(
                                0,
                                [],
                                "url",
                                title: "packTitle",
                                creator: "packCreator",
                                creatorId: 1
                            )

                            let mappingOfNfts <- {
                                "${packId1}" : <- nfts1,
                                "${packId2}" : <- nfts2
                            }

                            let packRelease <- self.minterRef.createNftPackRelease(id: "${releaseId}", <- mappingOfNfts, packData, price: 20)

                            self.platformSeller.depositRelease( <- packRelease)

                        }
                    }
                `;

                const result = await sendTransaction({ code, signers: [platformAccount]});
                const releasedata = getTransactionEventData(result, "SellerCatalog_ReleaseDeposited");
                return releasedata[0];
            };

            it('Successfully able to withdraw a pack from a release that exists when a specific packUUID is not specified', async () => {
                const release = await depositRelease()
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [release.id, null]})
                );
            });

            it('Successfully able to withdraw a pack from a release that exists when a specific packUUID is specified', async () => {
                const release = await depositRelease()
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [release.id, release.packIds[0]]})
                );
            });

            it('Fails to withdraw a pack from a release that does not exist', async () => {
                await depositRelease()
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                        }
                    }
                `;

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: ["non_existent_id", null]})
                );
            });

            it('Fails to withdraw a pack with a UUID  that does not exist within a release', async () => {
                const release = await depositRelease()
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                        }
                    }
                `;

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: [release.id, "non_existent_packUUID"]})
                );
            });

            it('Fails to withdraw a pack from a release that doesnt contain anymore packs', async () => {
                const release = await depositRelease()
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)
                            let pack1 <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)
                            let pack2 <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)
                            let pack3 <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                            destroy pack1
                            destroy pack2
                            destroy pack3
                        }
                    }
                `;

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: [release.id, null]})
                );
            });
        });
    });

    describe('SellerCatalog interface methods', () => {
        const bulkDepositReleases = async () => {
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
                            let inputData3 : [TheMoonNFTContract.MoonNftData] = [
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                                ),
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                                )
                            ]

                            let nfts1 <- self.minterRef.bulkMintNfts(inputData1)
                            let nfts2 <- self.minterRef.bulkMintNfts(inputData2)
                            let nfts3 <- self.minterRef.bulkMintNfts(inputData3)


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
                            let packData3 = TheMoonNFTContract.MoonNftPackData(
                                0,
                                [],
                                "url",
                                title: "packTitle",
                                creator: "testCreator3",
                                creatorId: 3
                            )

                            let mappingOfNfts1 <- {
                                "pack1UUID" : <- nfts1
                            }
                            let mappingOfNfts2 <- {
                                "pack2UUID" : <- nfts2
                            }
                            let mappingOfNfts3 <- {
                                "pack3UUID" : <- nfts3
                            }

                            let packRelease1 <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts1, packData1, price: 20)
                            let packRelease2 <- self.minterRef.createNftPackRelease(id: "release2", <- mappingOfNfts2, packData2, price: 20)
                            let packRelease3 <- self.minterRef.createNftPackRelease(id: "release3", <- mappingOfNfts3, packData3, price: 20)

                            self.platformSeller.bulkDepositRelease( <- [<- packRelease1, <- packRelease2, <- packRelease3])

                        }
                    }
                `;

                const result = await sendTransaction({ code, signers: [platformAccount]});

                const relevantEvents = getTransactionEventData(result, "SellerCatalog_ReleaseDeposited");

                return [...relevantEvents];
        };

        const bulkDepositNfts = async () => {
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
                            let inputData3 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(inputData1)
                            let nft2 <- self.minterRef.mintNFT(inputData2)
                            let nft3 <- self.minterRef.mintNFT(inputData3)

                            self.platformSeller.depositNft( <- nft1)
                            self.platformSeller.depositNft( <- nft2)
                            self.platformSeller.depositNft( <- nft3)
                        }
                    }
                `;

                const result = await sendTransaction({ code, signers: [platformAccount]});

                const relevantEvents = getTransactionEventData(result, "SellerCatalog_NftDeposited");

                return relevantEvents;
        };

        beforeEach(initialize);
        afterEach(shutDown);

        describe('getDataForAllReleases() method', () => {
            it('Accurately returns the data for all releases within the SellerCatalog at any point in time', async () => {

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address) : [${TheMoonNFTContract}.MoonNftReleaseData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getDataForAllReleases()
                    }
                `;

                let releasesResult = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                )

                expect(releasesResult).toBeArrayOfSize(0);

                const releaseData = await bulkDepositReleases();

                releasesResult = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                );

                expect(releasesResult).toBeArrayOfSize(releaseData.length);
                expect(releasesResult).toIncludeSameMembers(releaseData);
            });
        });

        describe('getTotalPackReleaseCount() method', () => {
            it('Accurately returns the count of all releases within the SellerCatalog at any point in time', async () => {

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address) : Int {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getTotalPackReleaseCount()
                    }
                `;

                let count = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                )

                expect(count).toBe(0);

                const releaseData = await bulkDepositReleases();

                count = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                );

                expect(count).toBe(releaseData.length);
            });
        });

        describe('packReleaseExists() method', () => {
            it('Returns true for a releaseId associated with a release that exists within the SellerCatalog', async () => {
                const releaseData = await bulkDepositReleases();
                const releaseId = releaseData[0].id;

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : Bool {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.packReleaseExists(id: releaseId)
                    }
                `;

                const releaseExists = await shallResolve(
                    executeScript({ code, args: [platformAccount, releaseId]})
                );

                expect(releaseExists).toBeTrue();
            });

            it('Returns false for a releaseId associated with a release that does not exist within the SellerCatalog', async () => {
                await bulkDepositReleases();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : Bool {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.packReleaseExists(id: releaseId)
                    }
                `;

                const releaseExists = await shallResolve(
                    executeScript({ code, args: [platformAccount, "release_that_does_not_exist"]})
                );

                expect(releaseExists).toBeFalse();
            });
        });

        describe('getPackReleaseData() method', () => {
            it('Returns releaseData for a release that exists with the SellerCatalog', async () => {
                const depositedReleasesData = await bulkDepositReleases();
                const firstRelease = depositedReleasesData[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : ${TheMoonNFTContract}.MoonNftReleaseData {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getPackReleaseData(id: releaseId)
                    }
                `;

                const releaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.id]})
                );

                expect(releaseData).not.toBeNull();
                expect(releaseData).toMatchObject(firstRelease);
            });

            it('Throws an error when trying to fetch data for a release that does not exist with the SellerCatalog', async () => {
                await bulkDepositReleases();

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : ${TheMoonNFTContract}.MoonNftReleaseData {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getPackReleaseData(id: releaseId)
                    }
                `;

                const releaseData = await shallRevert(
                    executeScript({ code, args: [platformAccount, "non_existent_release"]})
                );
            });
        });

        describe('getNftData() method', () => {
            it('Returns data for an MoonNft that exists with the SellerCatalog', async () => {
                const depositedNfts = await bulkDepositNfts();
                const firstNft = depositedNfts[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, nftId: UInt64) : ${TheMoonNFTContract}.MoonNftData {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftData(id: nftId)
                    }
                `;

                const releaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstNft.id]})
                );

                expect(releaseData).not.toBeNull();
                expect(releaseData).toMatchObject(firstNft);
            });

            it('Throws an error when trying to fetch data for a MoonNft that does not exist with the SellerCatalog', async () => {
                await bulkDepositNfts();

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : ${TheMoonNFTContract}.MoonNftReleaseData {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getPackReleaseData(id: releaseId)
                    }
                `;

                const nftId = 10000;
                const releaseData = await shallRevert(
                    executeScript({ code, args: [platformAccount, nftId]})
                );
            });
        });

        describe('getDataForAllNfts() method', () => {
            it('Accurately returns the data for all MoonNfts within the SellerCatalog at any point in time', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address) : [${TheMoonNFTContract}.MoonNftData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getDataForAllNfts()
                    }
                `;

                let nftsResult = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                )

                expect(nftsResult).toBeArrayOfSize(0);

                const nftData = await bulkDepositNfts();

                nftsResult = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                );

                expect(nftsResult).toBeArrayOfSize(nftData.length);
                expect(nftsResult).toIncludeSameMembers(nftData);
            });
        });

        describe('getTotalNFTCount() method', () => {
            it('Accurately returns the count of all releases within the SellerCatalog at any point in time', async () => {

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address) : Int {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getTotalNFTCount()
                    }
                `;

                let count = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                )

                expect(count).toBe(0);

                const releaseData = await bulkDepositNfts();

                count = await shallResolve(
                    executeScript({ code, args: [platformAccount]})
                );

                expect(count).toBe(releaseData.length);
            });
        });

        describe('nftExists() method', () => {
            it('Returns true for a nftId associated with a MoonNft that exists within the SellerCatalog', async () => {
                const nftData = await bulkDepositNfts();
                const nftId = nftData[0].id;

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, nftId: UInt64) : Bool {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.nftExists(id: nftId)
                    }
                `;

                const nftExists = await shallResolve(
                    executeScript({ code, args: [platformAccount, nftId]})
                );

                expect(nftExists).toBeTrue();
            });

            it('Returns false for an nftId associated with a MoonNft that does not exist within the SellerCatalog', async () => {
                await bulkDepositNfts();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, nftId: UInt64) : Bool {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.nftExists(id: nftId)
                    }
                `;

                const releaseExists = await shallResolve(
                    executeScript({ code, args: [platformAccount, 1000]})
                );

                expect(releaseExists).toBeFalse();
            });
        });

        describe('getNftsByCreatorId() method', () => {
            it('Successfully returns the MoonNfts in Seller Catalog when a creatorId has MoonNft deposits associated with them', async () => {
                const nftData = await bulkDepositNfts();
                const firstNft = nftData[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.MoonNftData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreatorId(creatorId)
                    }
                `;

                const resultNftData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstNft.creatorId]})
                );

                expect(resultNftData).toBeArrayOfSize(1);
                expect(resultNftData).toIncludeSameMembers([firstNft])
            });

            it('Throws when a creatorId passed as arguments has no MoonNft deposits associated with them', async () => {
                await bulkDepositNfts();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.MoonNftData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreatorId(creatorId)
                    }
                `;

                const resultNftData = await shallThrow(
                    executeScript({ code, args: [platformAccount, 1000]})
                );
            });
        });

        describe('getNftsByCreator() method', () => {
            it('Successfully returns the MoonNfts in Seller Catalog when a creator has MoonNft deposits associated with them', async () => {
                const nftData = await bulkDepositNfts();
                const firstNft = nftData[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creator: String) : [${TheMoonNFTContract}.MoonNftData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreator(creator)
                    }
                `;

                const resultNftData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstNft.originalContentCreator]})
                );

                expect(resultNftData).toBeArrayOfSize(1);
                expect(resultNftData).toIncludeSameMembers([firstNft])
            });

            it('Throws when a creator passed as arguments has no MoonNft deposits associated with them', async () => {
                await bulkDepositNfts();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creator: String) : [${TheMoonNFTContract}.MoonNftData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreator(creator)
                    }
                `;

                const resultNftData = await shallThrow(
                    executeScript({ code, args: [platformAccount, "non_existentCreator"]})
                );
            });
        });

        describe('getPackReleasesByCreatorId() method', () => {
            it('Successfully returns the release data in Seller Catalog when a creatorId passed as an argument has MoonNft deposits associated with them', async () => {
                const releaseData = await bulkDepositReleases();
                const firstRelease = releaseData[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.MoonNftReleaseData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getPackReleasesByCreatorId(creatorId)
                    }
                `;

                const resultNftData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.creatorId]})
                );

                expect(resultNftData).toBeArrayOfSize(1);
                expect(resultNftData).toIncludeSameMembers([firstRelease])
            });

            it('Throws when a creatorId passed as arguments has no MoonNft deposits associated with them', async () => {
                await bulkDepositNfts();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.MoonNftReleaseData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreatorId(creatorId)
                    }
                `;

                const resultNftData = await shallThrow(
                    executeScript({ code, args: [platformAccount, 1000]})
                );
            });
        });

        describe('getPackReleasesByCreator() method', () => {
            it('Successfully returns the release data in Seller Catalog when a creator passed as an argument has MoonNft deposits associated with them', async () => {
                const releaseData = await bulkDepositReleases();
                const firstRelease = releaseData[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creator: String) : [${TheMoonNFTContract}.MoonNftReleaseData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getPackReleasesByCreator(creator)
                    }
                `;

                const resultNftData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.creator]})
                );

                expect(resultNftData).toBeArrayOfSize(1);
                expect(resultNftData).toIncludeSameMembers([firstRelease])
            });

            it('Throws when a creator passed as arguments has no MoonNft deposits associated with them', async () => {
                await bulkDepositNfts();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, creator: String) : [${TheMoonNFTContract}.MoonNftReleaseData] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getNftsByCreatorId(creator)
                    }
                `;

                const resultNftData = await shallThrow(
                    executeScript({ code, args: [platformAccount, "non_existent_creator"]})
                );
            });
        });

        describe('getCurrentPackIdsAvailableWithinRelease() method', () => {
            const withdrawPackFromRelease = async (releaseId, packUUID) => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction(releaseId: String, pId: String?) {
                        let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller

                        prepare(authAccount: AuthAccount) {
                            self.platformSeller = authAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                                panic("Could not borrow the Single Platform Seller")
                        }

                        execute {
                            let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: pId)

                            destroy pack
                        }
                    }
                `;

                const result = await sendTransaction({ code, signers: [platformAccount], args: [releaseId, packUUID]});
            };

            it('Throws if releaseId does not exist within seller Catalog', async () => {
                await bulkDepositReleases();
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : [String] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getCurrentPackIdsAvailableWithinRelease(id: releaseId)
                    }
                `;

                const resultReleaseData = await shallThrow(
                    executeScript({ code, args: [platformAccount, "non_existent_release"]})
                );
            });

            it('Returns the correct number packIds within release at any point in time', async () => {
                const releases = await bulkDepositReleases();
                const firstRelease = releases[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : [String] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getCurrentPackIdsAvailableWithinRelease(id: releaseId)
                    }
                `;

                let resultReleaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.id]})
                );

                expect(resultReleaseData).toIncludeSameMembers(firstRelease.packIds);

                const packIdToWithdraw = firstRelease.packIds.pop();

                await withdrawPackFromRelease(firstRelease.id, packIdToWithdraw);

                resultReleaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.id]})
                );

                expect(resultReleaseData).toIncludeSameMembers(firstRelease.packIds);
            });

            it('Returns an empty array if all packs within a release have been withdrawn', async () => {
                const releases = await bulkDepositReleases();
                const firstRelease = releases[0];

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (contractAddress: Address, releaseId: String) : [String] {
                        let moonPublicAccount = getAccount(contractAddress)

                        let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
                        let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                        return sellerCatalog.getCurrentPackIdsAvailableWithinRelease(id: releaseId)
                    }
                `;

                let resultReleaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.id]})
                );

                expect(resultReleaseData).toIncludeSameMembers(firstRelease.packIds);
                await withdrawPackFromRelease(firstRelease.id, null);

                resultReleaseData = await shallResolve(
                    executeScript({ code, args: [platformAccount, firstRelease.id]})
                );

                expect(resultReleaseData).toBeArrayOfSize(0)
            });
        })
    });
});
