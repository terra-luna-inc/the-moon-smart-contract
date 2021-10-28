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

jest.setTimeout(10000);
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

// helper methods
const testCreator = {
    creatorName: "testCreator1",
    creatorId: 1
};

const depositGroup = async (groupId, creator, count) => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction(count: Int, creator: String, creatorId: Int32, groupId: String) {
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

                var i = count;
                while (i > 0) {
                    inputData.append(
                        ${TheMoonNFTContract}.MoonNftData(
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

                let groupData = ${TheMoonNFTContract}.MoonNftData(
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
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction (
            releaseId: String,
            groupingsArray: [String],
            groupingsCount: Int,
            creator: String?,
            creatorId: Int32?,
        ) {
            let mintCollection: &TheMoonNFTContract.AdminMintedCollection
            let minterRef: &TheMoonNFTContract.NftMinter
            let platformSeller: &TheMoonNFTContract.SinglePlatformSeller

            prepare(principalMoonAccount: AuthAccount) {
                self.mintCollection = principalMoonAccount.borrow<&TheMoonNFTContract.AdminMintedCollection>(from: TheMoonNFTContract.ADMIN_MINT_COLLECTION_PATH) ??
                        panic("Could not borrow minted collection")

                self.minterRef = principalMoonAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.platformSeller = principalMoonAccount.borrow<&TheMoonNFTContract.SinglePlatformSeller>(from: TheMoonNFTContract.SINGLE_PLATFORM_SELLER_PATH) ??
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

                let packData  = TheMoonNFTContract.MoonNftPackData(
                    0 as UInt64,
                    [],
                    "previewMediaUrl1",
                    title: "releaseTitle",
                    creator: creator,
                    creatorId: creatorId
                )


                let nftGroupings:  @{String : [TheMoonNFTContract.MoonNft]} <- {}

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
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction {
            let userAccount: AuthAccount

            prepare(userAccount: AuthAccount) {
                self.userAccount = userAccount
            }

            execute {
                self.userAccount.save(<- ${TheMoonNFTContract}.createEmptyCollection(), to: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH)
                self.userAccount.link<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH, target: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH)
            }

            post {
                self.userAccount.getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH).check() :
                    "Account was unsuccessfully linked"
            }
        }
    `;

    await sendTransaction({ code, signers: [account]});
}

const transferPackToAccountFromPlatform = async (releaseId, recipientAccount) => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction(
            releaseId: String,
            recipientAccountAddress: Address,
        ) {
            let platformSeller: &${TheMoonNFTContract}.SinglePlatformSeller
            let recipientNftReceiver: &AnyResource{${TheMoonNFTContract}.NftReceiver}

            prepare(platformAccount: AuthAccount) {
                self.platformSeller = platformAccount.borrow<&${TheMoonNFTContract}.SinglePlatformSeller>(from: ${TheMoonNFTContract}.SINGLE_PLATFORM_SELLER_PATH) ??
                    panic("Could not borrow the Single Platform Seller")

                let recipientAccount = getAccount(recipientAccountAddress)

                let receiverCapability = recipientAccount.getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                self.recipientNftReceiver = receiverCapability.borrow()  ?? panic("Could not borrow NFT receiver for recipient account")
            }

            execute {
                let pack <- self.platformSeller.withdrawPackFromWithinRelease(releaseId, packUUID: nil)
                self.recipientNftReceiver.depositNftPack(pack: <- pack)
            }
        }
    `;

    return await sendTransaction({
        code,
        signers: [platformAccount],
        args: [releaseId, recipientAccount],
    });
}

const getAllReleasesScript = async () => {
    const scriptCode = `
        import ${TheMoonNFTContract} from ${platformAccount}

        pub fun main (contractAddress: Address) : [${TheMoonNFTContract}.MoonNftReleaseData] {
            let moonPublicAccount = getAccount(contractAddress)

            let sellerCatalogCapability = moonPublicAccount.getCapability<&{${TheMoonNFTContract}.SellerCatalog}>(${TheMoonNFTContract}.SELLER_CATALOG_PATH)
            let sellerCatalog = sellerCatalogCapability.borrow() ?? panic("Could not borrow seller catalog")

            return sellerCatalog.getDataForAllReleases()
        }
    `;

    const result = await executeScript({ code: scriptCode, args: [platformAccount]});

    return result;
}

const getAllPackIdsScript = async (account) => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        pub fun main (userAccountAddress: Address) : [UInt64] {

            let nftReceiver = getAccount(userAccountAddress)
                .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                .borrow() ?? panic("unable to borrow nft receiver")

            return nftReceiver.getNftPackIds();
        }
    `;

    return await executeScript({ code, args: [account]});
}

const getAllNftIdsScript = async (account) => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        pub fun main (userAccountAddress: Address) : [UInt64] {

            let nftReceiver = getAccount(userAccountAddress)
                .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                .borrow() ?? panic("unable to borrow nft receiver")

            return nftReceiver.getNftIds();
        }
    `;

    return await executeScript({ code, args: [account]});
}


describe('As an Asset Owner ', () => {
    let user1;
    let user2;

    beforeAll(async () => {
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

        user1 = await getAccountAddress("user1");
        user2 = await getAccountAddress("user2");

        await addNftReceiverToAccount(user1);
        await addNftReceiverToAccount(user2);
    });
    afterAll(shutDown);

    describe('I would like to be accept a MoonNftPack from another user', () => {
        beforeEach(async () => {
            const releases = await getAllReleasesScript();

            await transferPackToAccountFromPlatform(releases[0].id, user1);
        });

        const packIdExistsScript = async (account, packId) => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, packId: UInt64) : Bool {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.packIdExists(packId)
                }
            `;

            return await executeScript({ code, args: [account, packId]});
        };

        const getAllPackIdsScript = async (account) => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [UInt64] {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getNftPackIds();
                }
            `;

            return await executeScript({ code, args: [account]});
        }

        it('Is able to receive a pack from another user', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(packId: UInt64, depositAccountAddress: Address) {
                    let collectionRef: &${TheMoonNFTContract}.AssetCollection
                    let recipientNftReceiver: &AnyResource{${TheMoonNFTContract}.NftReceiver}

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")

                        self.recipientNftReceiver = getAccount(depositAccountAddress)
                            .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                            .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                    }

                    execute {
                        let pack <- self.collectionRef.withdrawPack(packId: packId)
                        self.recipientNftReceiver.depositNftPack(pack: <- pack)
                    }
                }
            `;

            const packIds = await getAllPackIdsScript(user1);
            const packToTransfer = packIds[0];

            const result = await shallPass(
                sendTransaction({
                    code,
                    signers: [user1],
                    args: [packToTransfer, user2]
                })
            );

            const withdrawalEvents = getTransactionEventData(result, "AssetCollection_NftPackWithdrawn");
            const depositEvents = getTransactionEventData(result, "AssetCollection_NftPackDeposit");

            expect(withdrawalEvents).toBeArrayOfSize(1);
            expect(depositEvents).toBeArrayOfSize(1);

            const packExistsWithinUser2Account = await packIdExistsScript(user2, packToTransfer)

            expect(packExistsWithinUser2Account).toBeTrue();
        });


    });

    describe('I would like to be accept a MoonNft from another user', () => {
        const depositNftWithinAccount = async (account) => {

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(depositAccountAddress: Address) {
                    let minterRef: &${TheMoonNFTContract}.NftMinter
                    let recipientNftReceiver: &AnyResource{${TheMoonNFTContract}.NftReceiver}

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.recipientNftReceiver = getAccount(depositAccountAddress)
                            .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                            .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                    }

                    execute {
                        let nftData1 = ${TheMoonNFTContract}.MoonNftData(
                            0,
                            "url",
                            creator: "testCreator",
                            creatorId: 1,
                            metadata: {}
                        )

                        let nft1 <- self.minterRef.mintNFT(nftData1)

                        self.recipientNftReceiver.depositNft(token: <- nft1)
                    }
                }
            `;

            const result = await sendTransaction({ code, signers: [platformAccount], args:[account]});

            const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
            return relevantEvents[0];
        };

        const nftIdExistsScript = async (account, nftId) => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, nftId: UInt64) : Bool {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.nftIdExists(nftId)
                }
            `;

            return await executeScript({ code, args: [account, nftId]});
        };

        beforeEach(async () => {
            await depositNftWithinAccount(user2);
        });

        it('Able to receive a MoonNft from another user', async () => {
            const nftIds = await getAllNftIdsScript(user2);

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(nftId: UInt64, depositAccountAddress: Address) {
                    let collectionRef: &${TheMoonNFTContract}.AssetCollection
                    let recipientNftReceiver: &AnyResource{${TheMoonNFTContract}.NftReceiver}

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")

                        self.recipientNftReceiver = getAccount(depositAccountAddress)
                            .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                            .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                    }

                    execute {
                        let nft <- self.collectionRef.withdrawNft(id: nftId)
                        self.recipientNftReceiver.depositNft(token: <- nft)
                    }
                }
            `;

            const nftToTransfer = nftIds[0];

            const result = await shallPass(
                sendTransaction({
                    code,
                    signers: [user2],
                    args: [nftToTransfer, user1]
                })
            );

            const withdrawalEvents = getTransactionEventData(result, "AssetCollection_NftWithdrawn");
            const depositEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");

            expect(withdrawalEvents).toBeArrayOfSize(1);
            expect(depositEvents).toBeArrayOfSize(1);

            const nftExistsWithinUser1Account = await nftIdExistsScript(user1, nftToTransfer)

            expect(nftExistsWithinUser1Account).toBeTrue();

        });
    });

    describe('I would like to be open my own pack at any time', () => {
        beforeEach(async () => {
            const releases = await getAllReleasesScript();

            await transferPackToAccountFromPlatform(releases[0].id, user2);
        });

        it('Opens a pack that exists within a users collection', async () => {
            const packIds = await getAllPackIdsScript(user2);
            const firstPackId = packIds[0];

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(packId: UInt64) {
                    let collectionRef: &${TheMoonNFTContract}.AssetCollection

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")

                    }

                    execute {
                        self.collectionRef.openPackAndDepositNfts(packId: packId)
                    }
                }
            `;

            const result = await shallPass(
                sendTransaction({
                    code,
                    signers: [user2],
                    args: [firstPackId]
                })
            );

            const packOpenedEvents = await getTransactionEventData(result, "AssetCollection_MoonNftPackOpened");
            expect(packOpenedEvents).toBeArrayOfSize(1);

            const openedPackNftIds = packOpenedEvents[0].collectionNftIds;
            const currentNftIds = await getAllNftIdsScript(user2);

            expect(currentNftIds).toIncludeAllMembers(openedPackNftIds);
        });
    });
});
