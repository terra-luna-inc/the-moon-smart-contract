import 'regenerator-runtime/runtime';
import * as matchers from 'jest-extended';
import path from "path";
import {
    init,
    emulator,
    shallPass,
    sendTransaction,
    shallRevert,
    executeScript,
    getAccountAddress,
} from "flow-js-testing";
import { getTransactionEventName, initializePlatformAccount, deployNftContract, getTransactionEventData } from '../testHelpers';

jest.setTimeout(20000);
expect.extend(matchers);

const platformAccountName = "PlatformAccount";
const MoonNFT = "MoonNFT";

let platformAccount;

const initialize = async () => {
    const basePath = path.resolve(__dirname, "../../cadence");
    const port = 8080;

    await init(basePath, {port});
    await emulator.start(port);

    platformAccount = await initializePlatformAccount(platformAccountName);
    await deployNftContract(platformAccount, MoonNFT);
}

const shutDown = async () => {
    return await emulator.stop();
}

// helper methods

const depositGroup = async (groupId, creator, count) => {
    const code = `
        import ${MoonNFT} from ${platformAccount}

        transaction(count: Int, creator: String, creatorId: Int32, groupId: String) {
            let minterRef: &${MoonNFT}.NftMinter
            let mintCollection: &${MoonNFT}.AdminMintedCollection

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.mintCollection = authAccount.borrow<&${MoonNFT}.AdminMintedCollection>(from: ${MoonNFT}.ADMIN_MINT_COLLECTION_PATH) ??
                    panic("Could not borrow minted collection")
            }

            execute {
                let inputData : [MoonNFT.MoonNftData] = []

                var i = count;
                while (i > 0) {
                    inputData.append(
                        ${MoonNFT}.MoonNftData(
                            0,
                            "url1",
                            creator: creator,
                            creatorId: creatorId,
                            metadata: {}
                        )
                    )

                    i = i - 1
                }

                let nfts <- self.minterRef.bulkMintNfts(inputData)

                let groupData = ${MoonNFT}.MoonNftData(
                        0,
                        "previewUrl1",
                        creator: creator,
                        creatorId: creatorId,
                        metadata: {}
                )

                self.mintCollection.depositGroup(groupId, groupData, <- nfts)
            }
        }
    `;

    await sendTransaction({
        code,
        signers: [platformAccount],
        args: [
            count,
            creator.creatorName,
            creator.creatorId,
            groupId
        ]
    });
};

const depositReleaseToSeller = async (releaseId, creator, groupings, groupingsCount) => {
    const code = `
        import ${MoonNFT} from ${platformAccount}

        transaction (
            releaseId: String,
            groupingsArray: [String],
            groupingsCount: Int,
            creator: String?,
            creatorId: Int32?,
        ) {
            let mintCollection: &MoonNFT.AdminMintedCollection
            let minterRef: &MoonNFT.NftMinter
            let platformSeller: &MoonNFT.SinglePlatformSeller

            prepare(principalMoonAccount: AuthAccount) {
                self.mintCollection = principalMoonAccount.borrow<&MoonNFT.AdminMintedCollection>(from: MoonNFT.ADMIN_MINT_COLLECTION_PATH) ??
                        panic("Could not borrow minted collection")

                self.minterRef = principalMoonAccount.borrow<&MoonNFT.NftMinter>(from: MoonNFT.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.platformSeller = principalMoonAccount.borrow<&MoonNFT.SinglePlatformSeller>(from: MoonNFT.SINGLE_PLATFORM_SELLER_PATH) ??
                    panic("Could not borrow the Single Platform Seller")

            }

            execute {
                let groupings : {String: [String]} = {}
                var i = 0;
                while (i < groupingsCount) {
                    let packUUID = "packUUID".concat(i.toString())
                    groupings[packUUID] = groupingsArray
                    i = i + 1
                }

                let packData  = MoonNFT.MoonNftPackData(
                    0 as UInt64,
                    [],
                    "previewMediaUrl1",
                    title: "releaseTitle",
                    creator: creator,
                    creatorId: creatorId
                )


                let nftGroupings:  @{String : [MoonNFT.NFT]} <- {}

                for key in groupings.keys {
                    let groupIds = groupings[key]!
                    let nfts <- self.mintCollection.pickNfts(groupIds)
                    let nullNftArray <- nftGroupings.insert(key: key, <- nfts)
                    destroy nullNftArray
                }

                let releasePrice = 10

                let nftPackGrouping <- self.minterRef.createNftPackRelease(
                    id: releaseId,
                    <- nftGroupings,
                    packData,
                    price: releasePrice
                )

                self.platformSeller.depositRelease(<- nftPackGrouping)
            }
        }
    `;

    await sendTransaction({
        code,
        signers: [platformAccount],
        args: [
            releaseId,
            groupings,
            groupingsCount,
            creator.creatorName,
            creator.creatorId,
        ]
    })
}

const addNftReceiverToAccount = async (account) => {
    const code =   `
        import ${MoonNFT} from ${platformAccount}

        transaction {
            let userAccount: AuthAccount

            prepare(userAccount: AuthAccount) {
                self.userAccount = userAccount
            }

            execute {
                self.userAccount.save(<- ${MoonNFT}.createEmptyCollection(), to: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
                self.userAccount.link<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
            }

            post {
                self.userAccount.getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH).check() :
                    "Account was unsuccessfully linked"
            }
        }
    `;

    await sendTransaction({ code, signers: [account]});
}

describe('As an Nft Platform ', () => {
    const testCreator = {
        creatorName: "testCreator1",
        creatorId: 1
    };

    describe('I want to mint a certain number of common Nfts and be able to group them together in my pre-release collection (AdminMintedCollection)', () => {

        const groupId1 = "test_group1";

        const addToExistingTransactionCode = `
                import ${MoonNFT} from ${platformAccount}

                transaction(count: Int, creator: String, creatorId: Int32, groupId: String) {
                    let minterRef: &${MoonNFT}.NftMinter
                    let mintCollection: &${MoonNFT}.AdminMintedCollection

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.mintCollection = authAccount.borrow<&${MoonNFT}.AdminMintedCollection>(from: ${MoonNFT}.ADMIN_MINT_COLLECTION_PATH) ??
                            panic("Could not borrow minted collection")
                    }

                    execute {
                        let inputData : [MoonNFT.MoonNftData] = []

                        var i = count;
                        while (i > 0) {
                            inputData.append(
                                ${MoonNFT}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: creator,
                                    creatorId: creatorId,
                                    metadata: {}
                                )
                            )

                            i = i - 1
                        }

                        let nfts <- self.minterRef.bulkMintNfts(inputData)

                        let groupData = ${MoonNFT}.MoonNftData(
                                0,
                                "previewUrl1",
                                creator: creator,
                                creatorId: creatorId,
                                metadata: {}
                        )

                        self.mintCollection.addMoreNftsToDepositedGroup(groupId, nfts: <- nfts)
                    }
                }
            `;

        beforeAll(initialize);
        afterAll(shutDown);

        it('Able to mint common Nfts and add them to AdminMintedCollection', async () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                transaction(count: Int, creator: String, creatorId: Int32, groupId: String) {
                    let minterRef: &${MoonNFT}.NftMinter
                    let mintCollection: &${MoonNFT}.AdminMintedCollection

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.mintCollection = authAccount.borrow<&${MoonNFT}.AdminMintedCollection>(from: ${MoonNFT}.ADMIN_MINT_COLLECTION_PATH) ??
                            panic("Could not borrow minted collection")
                    }

                    execute {
                        let inputData : [MoonNFT.MoonNftData] = []

                        var i = count;
                        while (i > 0) {
                            inputData.append(
                                ${MoonNFT}.MoonNftData(
                                    0,
                                    "url1",
                                    creator: creator,
                                    creatorId: creatorId,
                                    metadata: {}
                                )
                            )

                            i = i - 1
                        }

                        let nfts <- self.minterRef.bulkMintNfts(inputData)

                        let groupData = ${MoonNFT}.MoonNftData(
                                0,
                                "previewUrl1",
                                creator: creator,
                                creatorId: creatorId,
                                metadata: {}
                        )

                        self.mintCollection.depositGroup(groupId, groupData, <- nfts)
                    }
                }
            `;

            const numberOfNftsToMint = 20;

            const result = await shallPass(
                sendTransaction({
                    code,
                    signers: [platformAccount],
                    args: [
                        numberOfNftsToMint,
                        testCreator.creatorName,
                        testCreator.creatorId,
                        groupId1
                    ]
                })
            );

            const mintedEvents = getTransactionEventData(result, "NftMinter_MoonNftMinted");
            const depositEvents = getTransactionEventData(result, "AdminMintedCollection_NftGroupDeposited");

            expect(mintedEvents).toBeArrayOfSize(numberOfNftsToMint);
            expect(depositEvents).toBeArrayOfSize(1);
        });

        it('Able to add more minted Nfts to an already existing group', async () => {

            const numberOfExtraNftsToMint = 20;

            const result = await shallPass(
                sendTransaction({
                    code: addToExistingTransactionCode,
                    signers: [platformAccount],
                    args: [
                        numberOfExtraNftsToMint,
                        testCreator.creatorName,
                        testCreator.creatorId,
                        groupId1
                    ]
                })
            );

            const mintedEvents = getTransactionEventData(result, "NftMinter_MoonNftMinted");
            const updateEvents = getTransactionEventData(result, "AdminMintedCollection_NftGroupUpdated");

            expect(mintedEvents).toBeArrayOfSize(numberOfExtraNftsToMint);
            expect(updateEvents).toBeArrayOfSize(1);
        });

        it('Unable to add more minted Nfts to a group that doesnt exist', async () => {


            const numberOfExtraNftsToMint = 20;

            const result = await shallRevert(
                sendTransaction({
                    code: addToExistingTransactionCode,
                    signers: [platformAccount],
                    args: [
                        numberOfExtraNftsToMint,
                        testCreator.creatorName,
                        testCreator.creatorId,
                        "non_existentId"
                    ]
                })
            );
        });
    });

    describe('I want to be able to create a new release using Nfts that I minted previously minted and deposit them in my Catalog', () => {

        const pickAndCreateReleaseTransactionCode = `
            import ${MoonNFT} from ${platformAccount}

            transaction (
                releaseId: String,
                groupingsArray: [String],
                groupingsCount: Int,
                creator: String?,
                creatorId: Int32?,
            ) {
                let mintCollection: &MoonNFT.AdminMintedCollection
                let minterRef: &MoonNFT.NftMinter
                let platformSeller: &MoonNFT.SinglePlatformSeller

                prepare(principalMoonAccount: AuthAccount) {
                    self.mintCollection = principalMoonAccount.borrow<&MoonNFT.AdminMintedCollection>(from: MoonNFT.ADMIN_MINT_COLLECTION_PATH) ??
                            panic("Could not borrow minted collection")

                    self.minterRef = principalMoonAccount.borrow<&MoonNFT.NftMinter>(from: MoonNFT.MINTER_STORAGE_PATH) ??
                        panic("Could not borrow nft minter")

                    self.platformSeller = principalMoonAccount.borrow<&MoonNFT.SinglePlatformSeller>(from: MoonNFT.SINGLE_PLATFORM_SELLER_PATH) ??
                        panic("Could not borrow the Single Platform Seller")

                }

                execute {
                    let groupings : {String: [String]} = {}
                    var i = 0;
                    while (i < groupingsCount) {
                        let packUUID = "packUUID".concat(i.toString())
                        groupings[packUUID] = groupingsArray
                        i = i + 1
                    }

                    let packData  = MoonNFT.MoonNftPackData(
                        0 as UInt64,
                        [],
                        "previewMediaUrl1",
                        title: "releaseTitle",
                        creator: creator,
                        creatorId: creatorId
                    )


                    let nftGroupings:  @{String : [MoonNFT.NFT]} <- {}

                    for key in groupings.keys {
                        let groupIds = groupings[key]!
                        let nfts <- self.mintCollection.pickNfts(groupIds)
                        let nullNftArray <- nftGroupings.insert(key: key, <- nfts)
                        destroy nullNftArray
                    }

                    let releasePrice = 10

                    let nftPackGrouping <- self.minterRef.createNftPackRelease(
                        id: releaseId,
                        <- nftGroupings,
                        packData,
                        price: releasePrice
                    )

                    self.platformSeller.depositRelease(<- nftPackGrouping)
                }
            }
        `;

        const getAllGroupsScript = async () => {
            const scriptCode = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (accountAddress: Address) : [${MoonNFT}.NftGroupData] {
                    let moonPublicAccount = getAccount(accountAddress)

                    let queryCapability = moonPublicAccount.getCapability<&{${MoonNFT}.QueryMintedCollection}>(${MoonNFT}.QUERY_MINTED_COLLECTION_PATH)
                    let query = queryCapability.borrow() ?? panic("Unable to borrow QueryMintedCollection")

                    let nftGroupData = query.getAllGroups()

                    return nftGroupData
                }
            `;

            const result = await executeScript({ code: scriptCode, args: [platformAccount]});

            return result;
        }

        beforeEach(async () => {
            await initialize();

            await depositGroup("testGroup1", testCreator, 5);
            await depositGroup("testGroup2", testCreator, 5);
            await depositGroup("testGroup3", testCreator, 2);
        });
        afterEach(shutDown);


        it('Can Successfully pick Nfts from a Groupings within the AdminMintedCollection and create a new MoonNftRelease', async () => {
            const groups = await getAllGroupsScript();

            const group1 = groups[0].groupId;
            const group2 = groups[1].groupId;
            const group3 = groups[2].groupId;

            const groupings = [group1, group2, group3];
            const groupingsCount = 2;

            const result = await shallPass(
                sendTransaction({
                    code: pickAndCreateReleaseTransactionCode,
                    signers: [platformAccount],
                    args: [
                        'release1',
                        groupings,
                        groupingsCount,
                        testCreator.creatorName,
                        testCreator.creatorId,
                    ]
                })
            );

            const releaseCreatedEvents = getTransactionEventData(result, "NftMinter_MoonNftPackReleaseCreated");
            const releaseDepositedEvents = getTransactionEventData(result, "SellerCatalog_ReleaseDeposited");
            const packCreatedEvents = getTransactionEventData(result, "NftMinter_MoonNftPackCreated");

            expect(releaseCreatedEvents).toBeArrayOfSize(1);
            expect(releaseDepositedEvents).toBeArrayOfSize(1);
            expect(packCreatedEvents).toBeArrayOfSize(groupingsCount);
        });

        it('Throws an error when trying to pick MoonNfts from a grouping that has been exhausted', async () => {
            const groups = await getAllGroupsScript();

            const group1 = groups[0].groupId; // 5 Nfts available
            const group2 = groups[1].groupId; // 5 Nfts available
            const group3 = groups[2].groupId; // 2 Nfts available

            const groupings = [group1, group2, group3];
            const groupingsCount = 3;

            await shallRevert(
                sendTransaction({
                    code: pickAndCreateReleaseTransactionCode,
                    signers: [platformAccount],
                    args: [
                        'release1',
                        groupings,
                        groupingsCount,
                        testCreator.creatorName,
                        testCreator.creatorId,
                    ]
                })
            );
        });

        it('Throws an error when trying to create a release with a releaseId that already exists', async () => {
            const groups = await getAllGroupsScript();

            const group1 = groups[0].groupId; // 5 Nfts available
            const group2 = groups[1].groupId; // 5 Nfts available
            const group3 = groups[2].groupId; // 2 Nfts available

            let groupings = [group1, group2, group3];
            const groupingsCount = 2;
            const releaseId = 'release1';

            await shallPass(
                sendTransaction({
                    code: pickAndCreateReleaseTransactionCode,
                    signers: [platformAccount],
                    args: [
                        releaseId,
                        groupings,
                        groupingsCount,
                        testCreator.creatorName,
                        testCreator.creatorId,
                    ]
                })
            );

            groupings = [group1, group2];

            await shallRevert(
                sendTransaction({
                    code: pickAndCreateReleaseTransactionCode,
                    signers: [platformAccount],
                    args: [
                        releaseId,
                        groupings,
                        groupingsCount,
                        testCreator.creatorName,
                        testCreator.creatorId,
                    ]
                })
            );
        });
    });

    describe('I want to be able transfer a pack from a release to another users account', () => {
        const addNftReceiverToAccount = async (account) => {
            const code =   `
                import ${MoonNFT} from ${platformAccount}

                transaction {
                    let userAccount: AuthAccount

                    prepare(userAccount: AuthAccount) {
                        self.userAccount = userAccount
                    }

                    execute {
                        self.userAccount.save(<- ${MoonNFT}.createEmptyCollection(), to: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
                        self.userAccount.link<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
                    }

                    post {
                        self.userAccount.getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH).check() :
                            "Account was unsuccessfully linked"
                    }
                }
            `;

            await sendTransaction({ code, signers: [account]});
        }

        const transferTransactionCode = `
            import ${MoonNFT} from ${platformAccount}

            transaction(
                releaseId: String,
                recipientAccountAddress: Address,
            ) {
                let platformSeller: &MoonNFT.SinglePlatformSeller
                let recipientNftReceiver: &AnyResource{MoonNFT.MoonCollectionPublic}

                prepare(platformAccount: AuthAccount) {
                    self.platformSeller = platformAccount.borrow<&MoonNFT.SinglePlatformSeller>(from: MoonNFT.SINGLE_PLATFORM_SELLER_PATH) ??
                        panic("Could not borrow the Single Platform Seller")

                    let recipientAccount = getAccount(recipientAccountAddress)

                    let receiverCapability = recipientAccount.getCapability<&{MoonNFT.MoonCollectionPublic}>(MoonNFT.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                    self.recipientNftReceiver = receiverCapability.borrow()  ?? panic("Could not borrow NFT receiver for recipient account")
                }

                execute {
                    let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: nil)
                    self.recipientNftReceiver.depositNftPack(pack: <- pack)
                }
            }
        `;

        const getAllReleasesScript = async () => {
            const scriptCode = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (contractAddress: Address) : [${MoonNFT}.MoonNftReleaseData] {
                    let moonPublicAccount = getAccount(contractAddress)

                    let sellerCatalogCapability = moonPublicAccount.getCapability<&{${MoonNFT}.SellerCatalog}>(${MoonNFT}.SELLER_CATALOG_PATH)
                    let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

                    return sellerCatalog.getDataForAllReleases()
                }
            `;

            const result = await executeScript({ code: scriptCode, args: [platformAccount]});

            return result;
        }


        let testUserAccount;

        beforeEach(async () => {
            await initialize();

            const groupIds = [
                "testGroup1",
                "testGroup2",
                "testGroup3",
            ];

            await depositGroup(groupIds[0], testCreator, 10);
            await depositGroup(groupIds[1], testCreator, 10);
            await depositGroup(groupIds[2], testCreator, 10);

            await depositReleaseToSeller("release1", testCreator, groupIds, 5);
            await depositReleaseToSeller("release2", testCreator, groupIds, 5);

            testUserAccount = await getAccountAddress("testUserAccount");
            await addNftReceiverToAccount(testUserAccount)
        });
        afterEach(shutDown);

        it('Able to successfully transfer a release from the platform account to another users account', async () => {
            const releases = await getAllReleasesScript();

            const result = await shallPass(
                sendTransaction({
                    code: transferTransactionCode,
                    signers: [platformAccount],
                    args: [
                        releases[0].id,
                        testUserAccount,
                    ]
                })
            );

            const packDepositEvents = getTransactionEventData(result, "AssetCollection_NftPackDeposit");
            expect(packDepositEvents).toBeArrayOfSize(1);
        });

        it('Throws when trying to transfer a release that doesnt exist from the platform account to another users account', async () => {
            const result = await shallRevert(
                sendTransaction({
                    code: transferTransactionCode,
                    signers: [platformAccount],
                    args: [
                        "non_existent_release",
                        testUserAccount,
                    ]
                })
            );

        });
    });
});
