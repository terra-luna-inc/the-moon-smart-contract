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

    platformAccount = await initializePlatformAccount();
    await deployNftContract(platformAccount, TheMoonNFTContract);
}

const shutDown = async () => {
    return await emulator.stop();
}

describe('AdminMintedCollection Resource and QueryMintedCollection interface', () => {
    describe('AdminMintedCollection resource methods (Methods not implemented from the QueryMintedCollection interface)', () => {
        beforeEach(initialize);
        afterEach(shutDown);

        describe('depositGroup() method' , () => {
            it('Successfully deposits a group of nfts', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let inputData : [TheMoonNFTContract.MoonNftData] = []
                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            let nfts <- self.minterRef.bulkMintNfts(inputData)

                            let groupData = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            self.mintCollection.depositGroup("test_groupId_1", groupData, <- nfts)
                        }
                    }
                `;

                const signers = [platformAccount];

                const result = await shallPass(
                    sendTransaction({ code, signers })
                );

                const relevantEvents = result.events.filter(event => getTransactionEventName(event.type) ===  "NftGroupDataCreated");

                expect(relevantEvents.length).toBe(1);
            });

            it('Fails to deposit a group of MoonNfts if an empty array of nfts is passed as an argument', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {

                            let groupData = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )


                            self.mintCollection.depositGroup("test_groupId_1", groupData, <- [])

                        }
                    }
                `;

                const signers = [platformAccount];

                const result = await shallRevert(
                    sendTransaction({ code, signers })
                );
            });

            it('Fails to deposit a group of MoonNfts if an invalid groupId is passed as an argument', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let inputData : [TheMoonNFTContract.MoonNftData] = []
                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            let nfts <- self.minterRef.bulkMintNfts(inputData)

                            let groupData = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            self.mintCollection.depositGroup("", groupData, <- nfts)
                        }
                    }
                `;

                const signers = [platformAccount];

                const result = await shallRevert(
                    sendTransaction({ code, signers })
                );
            });

            it('Fails to deposit a group of MoonNfts if a groupId that already exists is passed as an argument', async () => {
                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let inputData : [TheMoonNFTContract.MoonNftData] = []
                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            inputData.append(
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            )

                            let firstCollectionNfts <- self.minterRef.bulkMintNfts(inputData)
                            let secondCollectionNfts <- self.minterRef.bulkMintNfts(inputData)

                            let groupData = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            self.mintCollection.depositGroup("group1", groupData, <- firstCollectionNfts)
                            self.mintCollection.depositGroup("group1", groupData, <- secondCollectionNfts)
                        }
                    }
                `;

                const signers = [platformAccount];

                const result = await shallRevert(
                    sendTransaction({ code, signers })
                );
            });
        });

        describe('pickNfts() method', () => {
            const depositGroupTransaction = async () => {
                const groupId1 = "test_groupId_1";
                const groupId2 = "test_groupId_2";
                const groupId3 = "test_groupId_3";

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let inputData1 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]
                            let inputData2 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                                )
                            ]
                            let inputData3 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                                )
                            ]

                            let nftArray1 <- self.minterRef.bulkMintNfts(inputData1)
                            let nftArray2 <- self.minterRef.bulkMintNfts(inputData2)
                            let nftArray3 <- self.minterRef.bulkMintNfts(inputData3)

                            let groupData1 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            let groupData2 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                            )
                            let groupData3 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                            )

                            self.mintCollection.depositGroup("${groupId1}", groupData1, <- nftArray1)
                            self.mintCollection.depositGroup("${groupId2}", groupData2, <- nftArray2)
                            self.mintCollection.depositGroup("${groupId3}", groupData3, <- nftArray3)
                        }
                    }
                `;

                await sendTransaction({ code, signers : [platformAccount] })

                return {
                    groupId1,
                    groupId2,
                    groupId3,
                }
            };

            it('Successfully picks MoonNfts from groupings that exists within AdminMintedCollection without throwing an Error', async () => {

                const { groupId1, groupId2, groupId3 } = await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let groupIds = [
                                "${groupId1}",
                                "${groupId2}",
                                "${groupId3}"
                            ]

                            let nfts <- self.mintCollection.pickNfts(groupIds)

                            destroy nfts
                        }
                    }
                `;

                let pickResult = await shallPass(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );

                const relevantEvents = pickResult.events.filter(event => getTransactionEventName(event.type) ===  "MoonNftsPicked");

                expect(relevantEvents.length).toBe(1);
            });

            it('Fails to pick MoonNfts when an empty array is passed as an argument', async () => {

                const { groupId1, groupId2, groupId3 } = await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nfts <- self.mintCollection.pickNfts([])

                            destroy nfts
                        }
                    }
                `;

                let pickResult = await shallRevert(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );
            });

            it('Fails to pick MoonNfts if there no more Nfts to pick from a particular grouping', async () => {

                const { groupId1, groupId2, groupId3 } = await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let groupIds = [
                                "${groupId1}",
                                "${groupId2}",
                                "${groupId3}",
                                "${groupId3}"
                            ]

                            let nfts <- self.mintCollection.pickNfts(groupIds)

                            destroy nfts
                        }
                    }
                `;

                let pickResult = await shallRevert(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );
            });
        });

        describe('withdrawAllNftsForGroup() method', () => {
            const depositGroupTransaction = async () => {
                const groupId1 = "test_groupId_1";
                const groupId2 = "test_groupId_2";
                const groupId3 = "test_groupId_3";

                const code = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let minterRef: &${TheMoonNFTContract}.NftMinter
                        let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let inputData1 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]
                            let inputData2 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                                )
                            ]
                            let inputData3 = [
                                ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                                )
                            ]

                            let nftArray1 <- self.minterRef.bulkMintNfts(inputData1)
                            let nftArray2 <- self.minterRef.bulkMintNfts(inputData2)
                            let nftArray3 <- self.minterRef.bulkMintNfts(inputData3)

                            let groupData1 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                            )

                            let groupData2 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator2",
                                    creatorId: 2,
                                    metadata: {}
                            )
                            let groupData3 = ${TheMoonNFTContract}.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator3",
                                    creatorId: 3,
                                    metadata: {}
                            )

                            self.mintCollection.depositGroup("${groupId1}", groupData1, <- nftArray1)
                            self.mintCollection.depositGroup("${groupId2}", groupData2, <- nftArray2)
                            self.mintCollection.depositGroup("${groupId3}", groupData3, <- nftArray3)
                        }
                    }
                `;

                await sendTransaction({ code, signers : [platformAccount] })

                return {
                    groupId1,
                    groupId2,
                    groupId3,
                }
            };

            it('Successfully withdraws all MoonNfts from a group with a groupId that exists', async () => {
                const { groupId1 } = await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintedCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintedCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nfts <- self.mintedCollection.withdrawAllNftsForGroup("${groupId1}")

                            destroy nfts
                        }
                    }
                `;

                let pickResult = await shallPass(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );

                const relevantEvents = pickResult.events.filter(event => getTransactionEventName(event.type) ===  "MoonNftsPicked");

                expect(relevantEvents.length).toBe(1);
            });

            it('Fails to withdraw all MoonNfts from a group with a groupId that does not exist', async () => {
                await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintedCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintedCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nfts <- self.mintedCollection.withdrawAllNftsForGroup("")

                            destroy nfts
                        }
                    }
                `;

                let pickResult = await shallRevert(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );
            });

            it('Fails to withdraw all MoonNfts from a group with a groupId that has already withdrawn its all its MoonNfts', async () => {
                const { groupId1 } = await depositGroupTransaction();

                const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintedCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintedCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nftArray1 <- self.mintedCollection.withdrawAllNftsForGroup("${groupId1}")
                            let nftArray2 <- self.mintedCollection.withdrawAllNftsForGroup("${groupId1}")

                            destroy nftArray1
                            destroy nftArray2
                        }
                    }
                `;

                let pickResult = await shallRevert(
                    sendTransaction({ code: pickCode, signers : [platformAccount] })
                );
            });
        });
    });

    describe('QueryMintedCollection interface methods', () => {
        beforeEach(initialize);
        afterEach(shutDown);

        const depositFiveGroupsOfMoonNfts = async () => {
            const groupId1 = "test_groupId_1";
            const groupId2 = "test_groupId_2";
            const groupId3 = "test_groupId_3";
            const groupId4 = "test_groupId_4";
            const groupId5 = "test_groupId_5";

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &${TheMoonNFTContract}.NftMinter
                    let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                            panic("Could not borrow minted collection")
                    }

                    execute {
                        let inputData1 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url1",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            )
                        ]
                        let inputData2 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url2",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                            )
                        ]
                        let inputData3 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator3",
                                creatorId: 3,
                                metadata: {}
                            )
                        ]
                        let inputData4 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url4",
                                creator: "testCreator4",
                                creatorId: 4,
                                metadata: {}
                            )
                        ]
                        let inputData5 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url5",
                                creator: "testCreator5",
                                creatorId: 5,
                                metadata: {}
                            )
                        ]

                        let nftArray1 <- self.minterRef.bulkMintNfts(inputData1)
                        let nftArray2 <- self.minterRef.bulkMintNfts(inputData2)
                        let nftArray3 <- self.minterRef.bulkMintNfts(inputData3)
                        let nftArray4 <- self.minterRef.bulkMintNfts(inputData4)
                        let nftArray5 <- self.minterRef.bulkMintNfts(inputData5)

                        let groupData1 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url1",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                        )

                        let groupData2 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url2",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                        )
                        let groupData3 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator3",
                                creatorId: 3,
                                metadata: {}
                        )
                        let groupData4 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url4",
                                creator: "testCreator4",
                                creatorId: 4,
                                metadata: {}
                        )
                        let groupData5 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url5",
                                creator: "testCreator5",
                                creatorId: 5,
                                metadata: {}
                        )

                        self.mintCollection.depositGroup("${groupId1}", groupData1, <- nftArray1)
                        self.mintCollection.depositGroup("${groupId2}", groupData2, <- nftArray2)
                        self.mintCollection.depositGroup("${groupId3}", groupData3, <- nftArray3)
                        self.mintCollection.depositGroup("${groupId4}", groupData4, <- nftArray4)
                        self.mintCollection.depositGroup("${groupId5}", groupData5, <- nftArray5)
                    }
                }
            `;

            await sendTransaction({ code, signers : [platformAccount] })

            return [
                groupId1,
                groupId2,
                groupId3,
                groupId4,
                groupId5,
            ]
        };

        const depositFiveGroupsOfMoonNftsWithGroupInfo = async () => {
            const groupId1 = "test_groupId_1";
            const groupId2 = "test_groupId_2";
            const groupId3 = "test_groupId_3";
            const groupId4 = "test_groupId_4";
            const groupId5 = "test_groupId_5";

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &${TheMoonNFTContract}.NftMinter
                    let mintCollection: &${TheMoonNFTContract}.AdminMintedCollection

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.mintCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                            panic("Could not borrow minted collection")
                    }

                    execute {
                        let inputData1 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url1",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            )
                        ]
                        let inputData2 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url2",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                            )
                        ]
                        let inputData3 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator3",
                                creatorId: 3,
                                metadata: {}
                            )
                        ]
                        let inputData4 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url4",
                                creator: "testCreator4",
                                creatorId: 4,
                                metadata: {}
                            )
                        ]
                        let inputData5 = [
                            ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url5",
                                creator: "testCreator5",
                                creatorId: 5,
                                metadata: {}
                            )
                        ]

                        let nftArray1 <- self.minterRef.bulkMintNfts(inputData1)
                        let nftArray2 <- self.minterRef.bulkMintNfts(inputData2)
                        let nftArray3 <- self.minterRef.bulkMintNfts(inputData3)
                        let nftArray4 <- self.minterRef.bulkMintNfts(inputData4)
                        let nftArray5 <- self.minterRef.bulkMintNfts(inputData5)

                        let groupData1 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url1",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                        )

                        let groupData2 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url2",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                        )
                        let groupData3 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator3",
                                creatorId: 3,
                                metadata: {}
                        )
                        let groupData4 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url4",
                                creator: "testCreator4",
                                creatorId: 4,
                                metadata: {}
                        )
                        let groupData5 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url5",
                                creator: "testCreator5",
                                creatorId: 5,
                                metadata: {}
                        )

                        self.mintCollection.depositGroup("${groupId1}", groupData1, <- nftArray1)
                        self.mintCollection.depositGroup("${groupId2}", groupData2, <- nftArray2)
                        self.mintCollection.depositGroup("${groupId3}", groupData3, <- nftArray3)
                        self.mintCollection.depositGroup("${groupId4}", groupData4, <- nftArray4)
                        self.mintCollection.depositGroup("${groupId5}", groupData5, <- nftArray5)
                    }
                }
            `;

            const result = await sendTransaction({ code, signers : [platformAccount] })

            const relevantEventData = getTransactionEventData(result, "NftGroupDataCreated");

            return relevantEventData;
        };

        const pickNfts = async (nftsToPick) => {
            const pickCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintedCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintedCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nfts <- self.mintedCollection.pickNfts([${nftsToPick.join(',')}])

                            destroy nfts
                        }
                    }
            `;

            await sendTransaction({ code: pickCode, signers : [platformAccount] });
        };

        const withdrawAllNftsForGroup = async (groupId) => {
            const withdrawCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    transaction() {
                        let mintedCollection: &${TheMoonNFTContract}.AdminMintedCollection

                        prepare(authAccount: AuthAccount) {

                            self.mintedCollection = authAccount.borrow<&${TheMoonNFTContract}.AdminMintedCollection>(from: ${TheMoonNFTContract}.ADMIN_MINT_COLLECTION_PATH) ??
                                panic("Could not borrow minted collection")
                        }

                        execute {
                            let nfts <- self.mintedCollection.withdrawAllNftsForGroup("${groupId}")

                            destroy nfts
                        }
                    }
            `;

            await sendTransaction({ code: withdrawCode, signers : [platformAccount] });
        };

        describe('getAllGroups() method', () => {
            it('Returns all groups that have been deposited', async () => {
                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        let nftGroupData = query.getAllGroups()

                        return nftGroupData
                    }
                `;

                let result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                // no groups deposited yet
                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(0);

                const groupsArray = await depositFiveGroupsOfMoonNfts();

                result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                // 5 groups should have been deposited
                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(5);

                const resultGroupIds = result.map(group => group.groupId);

                expect(groupsArray).toIncludeAllMembers(resultGroupIds);
            });
        });

        describe('getGroupInfo() method', () => {
            it('Returns group info for a NftGroup that exists within MintedCollection', async () => {
                const [group1] = await depositFiveGroupsOfMoonNfts();

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, groupId: String) : ${TheMoonNFTContract}.NftGroupData {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        let nftGroupInfo = query.getGroupInfo(groupId)

                        return nftGroupInfo
                    }
                `;

                let result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, group1]
                    })
                );

                expect(result).toBeObject();
                expect(result).toMatchObject({
                    groupId: group1
                });
            });

            it('Fails to get group info for a NftGroup that does not exist within MintedCollection', async () => {
                const [group1] = await depositFiveGroupsOfMoonNfts();

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, groupId: String) : ${TheMoonNFTContract}.NftGroupData {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        let nftGroupInfo = query.getGroupInfo(groupId)

                        return nftGroupInfo
                    }
                `;

                let result = await shallThrow(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, ""]
                    })
                );

            });
        });

        describe('getAllIds() method', () => {
            it('Gets all MoonNft Ids that currently exist within the Minted collection', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();

                const nftIds = groupInfos.reduce((accumulatorArray, currentGroupInfo) => {
                    return [...accumulatorArray, ...currentGroupInfo.nftIds];
                }, []);

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address) : [UInt64] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        let nftIds = query.getAllNftIds()

                        return nftIds
                    }
                `;

                let result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(nftIds.length);
                expect(result).toIncludeSameMembers(nftIds);
            });

            it('Returns an empty array if there are no MoonNfts within Minted collection', async () => {
                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address) : [UInt64] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getAllNftIds()
                    }
                `;

                let result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(0);
            });

            it('Accurately reflects all nftIds currently within the Minted collection after a withdrawal', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();
                const nftIds = groupInfos.reduce((accumulatorArray, currentGroupInfo) => ([...accumulatorArray, ...currentGroupInfo.nftIds]), []);

                const nftGroupInfo = groupInfos[0];

                let scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address) : [UInt64] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        let nftIds = query.getAllNftIds()

                        return nftIds
                    }
                `;

                let result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(nftIds.length);
                expect(result).toIncludeSameMembers(nftIds);

                await withdrawAllNftsForGroup(nftGroupInfo.groupId);

                result = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount]
                    })
                );

                expect(result).toBeArray();
                expect(result).toBeArrayOfSize(nftIds.length - 1);

                const nftIdThatShouldNotBePresent = nftGroupInfo.nftIds[0];
                expect(result).not.toIncludeAnyMembers([nftIdThatShouldNotBePresent]);
            });
        });

        describe('groupIdExists() method', () => {
            it('Returns true for a groupId that exists within the Minted Collection', async () => {
                const [group1] = await depositFiveGroupsOfMoonNfts();

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, id: String) : Bool {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.groupIdExists(groupId: id)
                    }
                `;

                let groupExists = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, group1]
                    })
                );

                expect(groupExists).toBeTrue();
            });

            it('Returns false for a groupId that does not exist within the Minted Collection', async () => {
                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, id: String) : Bool {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.groupIdExists(groupId: id)
                    }
                `;

                let groupExists = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, "Some_group_that_doesnt_exist"]
                    })
                );

                expect(groupExists).toBeFalse();
            });
        });

        describe('getGroupInfoByCreator() method', () => {
            it('Gets all groupInfo for a creator who an Nft Group has been deposited for', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();
                const firstGroup = groupInfos[0];

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creator: String) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreator(creator)
                    }
                `;

                let groupInfoResult = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.originalContentCreator]
                    })
                );

                expect(groupInfoResult).toBeArrayOfSize(1);
                expect(groupInfoResult).toIncludeSameMembers([firstGroup]);
            });

            it('Throws an error when trying to get a Nft Group for a creator that has no deposits associated with them', async () => {
                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creator: String) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreator(creator)
                    }
                `;

                let groupInfoResult = await shallThrow(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, "Some_Non_Existent_Creator"]
                    })
                );
            });

            it('Throws an error when trying to get an NftGroup associated with a creator that was deposited then withdrawn', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();
                const firstGroup = groupInfos[0];

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creator: String) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreator(creator)
                    }
                `;

                let groupInfoResult = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.originalContentCreator]
                    })
                );

                expect(groupInfoResult).toBeArrayOfSize(1);
                expect(groupInfoResult).toIncludeSameMembers([firstGroup]);

                await withdrawAllNftsForGroup(firstGroup.groupId);

                await shallThrow(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.originalContentCreator]
                    })
                );
            });
        });

        describe('getGroupInfoByCreatorId() method', () => {
            it('Gets all groupInfo for a creatorId who has had an NftGroup associated with them', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();
                const firstGroup = groupInfos[0];

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreatorId(creatorId)
                    }
                `;

                let groupInfoResult = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.creatorId]
                    })
                );

                expect(groupInfoResult).toBeArrayOfSize(1);
                expect(groupInfoResult).toIncludeSameMembers([firstGroup]);
            });

            it('Throws an error when trying to get a Nft Group for a creatorId that has no deposits associated with them', async () => {
                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreatorId(creatorId)
                    }
                `;

                let groupInfoResult = await shallThrow(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, 1000]
                    })
                );
            });

            it('Throws an error when trying to get an NftGroup associated with a creatorId that was deposited then withdrawn', async () => {
                const groupInfos = await depositFiveGroupsOfMoonNftsWithGroupInfo();
                const firstGroup = groupInfos[0];

                const scriptCode = `
                    import ${TheMoonNFTContract} from ${platformAccount}

                    pub fun main (accountAddress: Address, creatorId: Int32) : [${TheMoonNFTContract}.NftGroupData] {
                        let moonPublicAccount = getAccount(accountAddress)

                        let queryCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.QueryMintedCollection}>(${TheMoonNFTContract}.QUERY_MINTED_COLLECTION_PATH)
                        let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                        return query.getGroupInfoByCreatorId(creatorId)
                    }
                `;

                let groupInfoResult = await shallResolve(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.creatorId]
                    })
                );

                expect(groupInfoResult).toBeArrayOfSize(1);
                expect(groupInfoResult).toIncludeSameMembers([firstGroup]);

                await withdrawAllNftsForGroup(firstGroup.groupId);

                await shallThrow(
                    executeScript({
                        code: scriptCode,
                        args: [platformAccount, firstGroup.metadata.creatorId]
                    })
                );
            });
        });
    });
});
