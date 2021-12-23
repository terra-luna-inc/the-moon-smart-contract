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
    getAccountAddress,
} from "flow-js-testing";
import { getTransactionEventName, initializePlatformAccount, deployNftContract, getTransactionEventData } from '../testHelpers';

jest.setTimeout(10000);
expect.extend(matchers);

const platformAccountName = "PlatformAccount";
const NonFungibleToken = "NonFungibleToken";
const MoonNFT = "MoonNFT";

let platformAccount;

const initialize = async () => {
    const basePath = path.resolve(__dirname, "../../cadence");
    const port = 8080;

    await init(basePath, {port});
    await emulator.start(port);

    platformAccount = await initializePlatformAccount(platformAccountName);
    const { NftContractAddress } = await deployNftContract(platformAccount, MoonNFT);

    return NftContractAddress;
}

const shutDown = async () => {
    return await emulator.stop();
}

const mintThenDepositNfts = async () => {
    const code = `
        import ${MoonNFT} from ${platformAccount}

        transaction() {
            let minterRef: &${MoonNFT}.NftMinter
            let collectionRef: &${MoonNFT}.Collection

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.collectionRef = authAccount.borrow<&${MoonNFT}.Collection>(from: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH) ??
                    panic("Could not borrow asset collection")
            }

            execute {
                let nftData1 = ${MoonNFT}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator",
                    creatorId: 1,
                    metadata: {}
                )
                let nftData2 = ${MoonNFT}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator2",
                    creatorId: 2,
                    metadata: {}
                )
                let nftData3 = ${MoonNFT}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator3",
                    creatorId: 3,
                    metadata: {}
                )

                let nft1 <- self.minterRef.mintNFT(nftData1)
                let nft2 <- self.minterRef.mintNFT(nftData2)
                let nft3 <- self.minterRef.mintNFT(nftData3)

                self.collectionRef.bulkDepositNfts(tokens: <- [ <- nft1, <- nft2, <- nft3 ])
            }
        }
    `;

    const result = await sendTransaction({ code, signers: [platformAccount]});

    const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");

    return relevantEvents[0]; // returns [MoonNftData]
};

const createThenDepositPacks = async () => {
    const code = `
        import ${MoonNFT} from ${platformAccount}

        transaction() {
            let minterRef: &${MoonNFT}.NftMinter
            let collectionRef: &${MoonNFT}.Collection

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.collectionRef = authAccount.borrow<&${MoonNFT}.Collection>(from: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH) ??
                    panic("Could not borrow asset collection")
            }

            execute {
                let inputData1 : [MoonNFT.MoonNftData] = [
                    MoonNFT.MoonNftData(
                        0,
                        "url1",
                        creator: "testCreator1",
                        creatorId: 1,
                        metadata: {}
                    ),
                    MoonNFT.MoonNftData(
                        0,
                        "url2",
                        creator: "testCreator1",
                        creatorId: 1,
                        metadata: {}
                    ),
                    MoonNFT.MoonNftData(
                        0,
                        "url3",
                        creator: "testCreator1",
                        creatorId: 1,
                        metadata: {}
                    )
                ]

                let inputData2 : [MoonNFT.MoonNftData] = [
                    MoonNFT.MoonNftData(
                        0,
                        "url1",
                        creator: "testCreator2",
                        creatorId: 2,
                        metadata: {}
                    ),
                    MoonNFT.MoonNftData(
                        0,
                        "url2",
                        creator: "testCreator2",
                        creatorId: 2,
                        metadata: {}
                    ),
                    MoonNFT.MoonNftData(
                        0,
                        "url3",
                        creator: "testCreator2",
                        creatorId: 2,
                        metadata: {}
                    )
                ]


                let nfts1 <- self.minterRef.bulkMintNfts(inputData1)
                let nfts2 <- self.minterRef.bulkMintNfts(inputData2)

                let packData1 = MoonNFT.MoonNftPackData(
                    0,
                    [],
                    "preview_url",
                    title: "packTitle1",
                    creator: "testCreator1",
                    creatorId: 1
                )

                let packData2 = MoonNFT.MoonNftPackData(
                    0,
                    [],
                    "preview_url",
                    title: "packTitle2",
                    creator: "testCreator2",
                    creatorId: 2
                )

                let nftPack1 <- self.minterRef.createNftPack(<- nfts1, packData1)
                let nftPack2 <- self.minterRef.createNftPack(<- nfts2, packData2)

                self.collectionRef.depositNftPack(pack: <- nftPack1)
                self.collectionRef.depositNftPack(pack: <- nftPack2)
            }
        }
    `;

    const result = await sendTransaction({ code, signers: [platformAccount]});

    const relevantEvents = getTransactionEventData(result, "AssetCollection_NftPackDeposit");

    return relevantEvents; // returns [MoonNftPackData]
};

const addNftReceiverToAccount = async (account, NftAddress) => {
    const code =   `
        import ${MoonNFT} from ${platformAccount}
        import ${NonFungibleToken} from ${NftAddress}

        transaction {
            let userAccount: AuthAccount

            prepare(userAccount: AuthAccount) {
                self.userAccount = userAccount
            }

            execute {
                self.userAccount.save(<- ${MoonNFT}.createEmptyCollection(), to: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)

                self.userAccount.link<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)

                // setup NonFungibleToken Infrastructure
                self.userAccount.link<&{${NonFungibleToken}.CollectionPublic}>(${MoonNFT}.PUBLIC_COLLECTION_PUBLIC_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
                self.userAccount.link<&{${NonFungibleToken}.Provider}>(${MoonNFT}.COLLECTION_PROVIDER_PRIVATE_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
                self.userAccount.link<&{${NonFungibleToken}.Receiver}>(${MoonNFT}.COLLECTION_RECEIVER_PUBLIC_PATH, target: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH)
            }

            post {
                self.userAccount.getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH).check() :
                    "Account was unsuccessfully linked"
            }
        }
    `;

    await sendTransaction({ code, signers: [account]});
}

const depositNftWithinInitializedAccount = async (account, initializeAccount = true, NftAddress = '') => {
    if (initializeAccount) {
        await addNftReceiverToAccount(account, NftAddress);
    }

    const code = `
        import ${MoonNFT} from ${platformAccount}

        transaction(depositAccountAddress: Address) {
            let minterRef: &${MoonNFT}.NftMinter
            let recipientNftReceiver: &AnyResource{${MoonNFT}.MoonCollectionPublic}

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.recipientNftReceiver = getAccount(depositAccountAddress)
                    .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                    .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
            }

            execute {
                let nftData1 = ${MoonNFT}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator",
                    creatorId: 1,
                    metadata: {}
                )

                let nft1 <- self.minterRef.mintNFT(nftData1)

                self.recipientNftReceiver.bulkDepositNfts(tokens: <- [ <- nft1])
            }
        }
    `;

    const result = await sendTransaction({ code, signers: [platformAccount], args:[account]});

    const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
    return relevantEvents[0];
}



describe('Collection resource and implemented resource interfaces', () => {
    describe('Collection resource methods (Methods not implemented from MoonCollectionPublic)', () => {
        beforeEach(initialize);
        afterEach(shutDown);

        describe('withdrawPack() method', () => {
            const withdrawTransactionCode = `
                import ${MoonNFT} from ${platformAccount}

                transaction(packId: UInt64) {
                    let collectionRef: &${MoonNFT}.Collection

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${MoonNFT}.Collection>(from: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")
                    }

                    execute {
                        let nftPack <- self.collectionRef.withdrawPack(packId: packId)

                        destroy nftPack
                    }
                }
            `;

            it('Successfully withdraws a MoonNftPack that exists with Asset Collection', async () => {
                const packData = await createThenDepositPacks();
                const firstPack = packData[0];

                const result = await shallPass(
                    sendTransaction({
                        code: withdrawTransactionCode,
                        signers: [platformAccount],
                        args: [firstPack.id]
                    })
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_NftPackWithdrawn")

                expect(relevantEvents).toBeArrayOfSize(1);
                expect(relevantEvents).toIncludeSameMembers([firstPack]);
            });

            it('Throws when trying to withdraw a MoonNftPack that doesnt exist within asset collection', async () => {
                await mintThenDepositNfts();

                const result = await shallRevert(
                    sendTransaction({ code: withdrawTransactionCode, signers: [platformAccount], args: [0]})
                );
            });
        });

        describe('openPackAndDepositNfts() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                transaction(packId: UInt64) {
                    let collectionRef: &${MoonNFT}.Collection

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${MoonNFT}.Collection>(from: ${MoonNFT}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")
                    }

                    execute {
                        self.collectionRef.openPackAndDepositNfts(packId: packId)
                    }
                }
            `;

            it('Successfully opens a pack that exists within the asset collection and deposits the nfts within the pack', async () => {
                const packData = await createThenDepositPacks();
                const firstPack = packData[0];

                const result = await shallPass(
                    sendTransaction({
                        code,
                        signers: [platformAccount],
                        args: [firstPack.id],
                    })
                );

                const packOpenedEvents = getTransactionEventData(result, "AssetCollection_MoonNftPackOpened");
                expect(packOpenedEvents).toBeArrayOfSize(1);

                const nftsDeposited = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
                expect(nftsDeposited).toBeArrayOfSize(firstPack.collectionNftIds.length);
            });

            it('Fails to open a pack with a packId that does not exist within the asset collection', async () => {
                await createThenDepositPacks();

                const result = await shallRevert(
                    sendTransaction({
                        code,
                        signers: [platformAccount],
                        args: [0],
                    })
                );
            });
        });
    });

    describe('MoonCollectionPublic interface methods', () => {
        let testAccount;
        let NftContractAddress;

        beforeEach(async () => {
            NftContractAddress = await initialize();
            testAccount = await getAccountAddress("testAccount");
        });
        afterEach(shutDown);

        const depositPackWithinInitializedAccount = async (account, initializeAccount = true) => {
            if (initializeAccount) {
                await addNftReceiverToAccount(account, NftContractAddress);
            }

            const code = `
                import ${MoonNFT} from ${platformAccount}

                transaction(depositAccountAddress: Address) {
                    let minterRef: &${MoonNFT}.NftMinter
                    let recipientNftReceiver: &AnyResource{${MoonNFT}.MoonCollectionPublic}

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")

                        self.recipientNftReceiver = getAccount(depositAccountAddress)
                            .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                            .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                    }

                    execute {
                        let inputData1 : [MoonNFT.MoonNftData] = [
                            MoonNFT.MoonNftData(
                                0,
                                "url1",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            ),
                            MoonNFT.MoonNftData(
                                0,
                                "url2",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            ),
                            MoonNFT.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            )
                        ]

                        let nfts1 <- self.minterRef.bulkMintNfts(inputData1)

                        let packData1 = MoonNFT.MoonNftPackData(
                            0,
                            [],
                            "preview_url",
                            title: "packTitle1",
                            creator: "testCreator1",
                            creatorId: 1
                        )

                        let nftPack1 <- self.minterRef.createNftPack(<- nfts1, packData1)

                        self.recipientNftReceiver.depositNftPack(pack: <- nftPack1)
                    }
                }
            `;

            const result = await sendTransaction({ code, signers: [platformAccount], args:[account]});

            const relevantEvents = getTransactionEventData(result, "AssetCollection_NftPackDeposit");
            return relevantEvents[0];
        }

        describe('bulkDepositNfts() method', () => {
            it('Successfully Deposits a MoonNfts within an asset collection for another account that has nft receiver capability', async () => {
                const testUserAccount = await getAccountAddress("testUserAccount");
                await addNftReceiverToAccount(testUserAccount, NftContractAddress);

                const code = `
                    import ${MoonNFT} from ${platformAccount}

                    transaction(depositAccountAddress: Address) {
                        let minterRef: &${MoonNFT}.NftMinter
                        let recipientNftReceiver: &AnyResource{${MoonNFT}.MoonCollectionPublic}

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.recipientNftReceiver = getAccount(depositAccountAddress)
                                .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                                .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                        }

                        execute {
                            let nftData1 = ${MoonNFT}.MoonNftData(
                                0,
                                "url",
                                creator: "testCreator",
                                creatorId: 1,
                                metadata: {}
                            )

                            let nftData2 = ${MoonNFT}.MoonNftData(
                                0,
                                "url",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(nftData1)
                            let nft2 <- self.minterRef.mintNFT(nftData2)

                            self.recipientNftReceiver.bulkDepositNfts(tokens: <- [<- nft1, <- nft2])
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [testUserAccount]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
                expect(relevantEvents).toBeArrayOfSize(2);
            });
        });

        describe('depositNftPack() method', () => {
            it('Successfully Deposits a MoonNftPack within an asset collection for another account that has nft receiver capability', async () => {
                const testUserAccount = await getAccountAddress("testUserAccount");
                await addNftReceiverToAccount(testUserAccount, NftContractAddress);

                const code = `
                    import ${MoonNFT} from ${platformAccount}

                    transaction(depositAccountAddress: Address) {
                        let minterRef: &${MoonNFT}.NftMinter
                        let recipientNftReceiver: &AnyResource{${MoonNFT}.MoonCollectionPublic}

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.recipientNftReceiver = getAccount(depositAccountAddress)
                                .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                                .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                        }

                        execute {
                            let inputData1 : [MoonNFT.MoonNftData] = [
                                MoonNFT.MoonNftData(
                                    0,
                                    "url1",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                ),
                                MoonNFT.MoonNftData(
                                    0,
                                    "url2",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                ),
                                MoonNFT.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]

                            let nfts1 <- self.minterRef.bulkMintNfts(inputData1)

                            let packData1 = MoonNFT.MoonNftPackData(
                                0,
                                [],
                                "preview_url",
                                title: "packTitle1",
                                creator: "testCreator1",
                                creatorId: 1
                            )

                            let nftPack1 <- self.minterRef.createNftPack(<- nfts1, packData1)

                            self.recipientNftReceiver.depositNftPack(pack: <- nftPack1)
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [testUserAccount]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_NftPackDeposit");
                expect(relevantEvents).toBeArrayOfSize(1);
            });
        });

        describe('nftIdExists() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address, nftId: UInt64) : Bool {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.nftIdExists(nftId)
                }
            `;

            it('Returns true when checking to see if a MoonNft in the asset collection exists', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount, true, NftContractAddress);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, nft.id]})
                );

                expect(exists).toBeTrue();
            });

            it('Returns false when checking to see if a MoonNft in the asset collection does not exists', async () => {
                await depositNftWithinInitializedAccount(testAccount,true, NftContractAddress);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, 0]})
                );

                expect(exists).toBeFalse();
            });
        });

        describe('packIdExists', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address, packId: UInt64) : Bool {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.packIdExists(packId)
                }
            `;

           it('Returns true when checking to see if a pack in the asset collection exists', async () => {
                const pack = await depositPackWithinInitializedAccount(testAccount);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, pack.id]})
                );

                expect(exists).toBeTrue();
            });

            it('Returns false when checking to see if a pack in the asset collection does not exist', async () => {
                await depositNftWithinInitializedAccount(testAccount,true, NftContractAddress);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, 0]})
                );

                expect(exists).toBeFalse();
            });

        });

        describe('getDataForAllNfts() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [${MoonNFT}.MoonNftData] {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.getDataForAllNfts()
                }
            `;

            it('Gets data for all MoonNfts that exist within the asset collection', async () => {
                const firstNft = await depositNftWithinInitializedAccount(testAccount,true, NftContractAddress);

                let result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toIncludeSameMembers([firstNft]);

                const secondNft = await depositNftWithinInitializedAccount(testAccount, false);

                result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toIncludeSameMembers([firstNft, secondNft]);
            });

            it('Returns an empty array when no Nfts exist in the asset collection', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toBeArrayOfSize(0);
            });
        });

        describe('getNftPackIds() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [UInt64] {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.getNftPackIds()
                }
            `;

            it('Returns an empty array when no MoonNfts have been deposited', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                const nftIds = await (
                    executeScript({ code, args: [testAccount] })
                );

                expect(nftIds).toBeArrayOfSize(0);
            });

            it('Returns a accurate array of pack ids when MoonNfts have been deposited', async () => {
                const pack = await depositPackWithinInitializedAccount(testAccount);

                const packIds = await (
                    executeScript({ code, args: [testAccount] })
                );

                expect(packIds).toIncludeSameMembers([pack.id]);
            });
        });

        describe('getNftPackData() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address, id: UInt64) : ${MoonNFT}.MoonNftPackData {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.getNftPackData(id: id)
                }
            `;

            it('Returns MoonNftPackData for a MoonNftPack that exists', async () => {
                const pack = await depositPackWithinInitializedAccount(testAccount);

                const packDataResult = await shallResolve(
                    executeScript({ code, args: [testAccount, pack.id]})
                );

                expect(packDataResult).toMatchObject(pack);
            });

            it('Throws when trying to get MoonNftPackData for a MoonNftPack that does not exist', async () => {
                await depositPackWithinInitializedAccount(testAccount);

                await shallThrow(
                    executeScript({ code, args: [testAccount, 0]})
                );
            });
        });

        describe('getDataForAllPacks() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [${MoonNFT}.MoonNftPackData] {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.getDataForAllPacks()
                }
            `;

            it('Gets data for all MoonNftPacks that exist within the asset collection', async () => {
                const firstPack = await depositPackWithinInitializedAccount(testAccount);

                let result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toIncludeSameMembers([firstPack]);

                const secondPack = await depositPackWithinInitializedAccount(testAccount, false);

                result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toIncludeSameMembers([firstPack, secondPack]);
            });

            it('Returns an empty array when no MoonNftPacks exist in the asset collection', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toBeArrayOfSize(0);
            });
        });

        describe('borrowMoonNft() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}

                pub fun main (userAccountAddress: Address, id: UInt64) : UInt64 {

                    let MoonCollectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${MoonNFT}.MoonCollectionPublic}>(${MoonNFT}.MOON_PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return MoonCollectionPublic.borrowMoonNft(id: id)!.id
                }
            `;

            it('Successfully Borrows a valid MoonNft.NFT without', async () => {

                const nft = await depositNftWithinInitializedAccount(testAccount,true, NftContractAddress);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount, nft.id]})
                );

                expect(result).toBe(nft.id);
            });

            it('Throws when borrowing an MoonNft.NFT that doesnt exist', async () => {
                await shallThrow(
                    executeScript({ code, args: [testAccount, 5000]})
                );
            });
        });
    });

    describe('NonFungibleToken.Provider interface methods', () => {
        let testAccount;
        let NftContractAddress;

        beforeEach(async () => {
            NftContractAddress = await initialize();
            testAccount = await getAccountAddress("testAccount");
        });
        afterEach(shutDown);

        const code = `
            import ${MoonNFT} from ${platformAccount}
            import ${NonFungibleToken} from ${NftContractAddress}

            transaction(nftId: UInt64) {
                let collectionPublic: &AnyResource{${NonFungibleToken}.Provider}

                prepare(authAccount: AuthAccount) {

                    self.collectionPublic = authAccount
                        .getCapability<&{${NonFungibleToken}.Provider}>(${MoonNFT}.COLLECTION_PROVIDER_PRIVATE_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                }

                execute {
                    let nft <- self.collectionPublic.withdraw(withdrawID: nftId)

                    destroy nft
                }
            }
        `;

        describe('withdraw() method', () => {
            it('should withdraw an NFT that exists successfully', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount, true, NftContractAddress);

                await shallPass(
                    sendTransaction({ code, signers: [testAccount], args: [nft.id]})
                );
            });

            it('Throws when withdrawing an NFT that doesnt exists', async () => {
                await shallRevert(
                    sendTransaction({ code, signers: [testAccount], args: [1000]})
                );
            });
        });
    });

    describe('NonFungibleToken.Receiver interface methods', () => {
        let testAccount;
        let NftContractAddress;

        beforeEach(async () => {
            NftContractAddress = await initialize();
            testAccount = await getAccountAddress("testAccount");
        });
        afterEach(shutDown);

        describe('deposit() method', () => {
            it('Successfully Deposits a MoonNFT.NFT within an asset collection for another account using the receiver interface', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                const code = `
                    import ${MoonNFT} from ${platformAccount}
                    import ${NonFungibleToken} from ${NftContractAddress}

                    transaction(depositAccountAddress: Address) {
                        let minterRef: &${MoonNFT}.NftMinter
                        let receiver: &AnyResource{${NonFungibleToken}.Receiver}

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.receiver = getAccount(depositAccountAddress)
                                .getCapability<&{${NonFungibleToken}.Receiver}>(${MoonNFT}.COLLECTION_RECEIVER_PUBLIC_PATH)
                                .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                        }

                        execute {
                            let nftData1 = ${MoonNFT}.MoonNftData(
                                0,
                                "url",
                                creator: "testCreator",
                                creatorId: 1,
                                metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(nftData1)

                            self.receiver.deposit(token: <- nft1)
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [testAccount]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
                expect(relevantEvents).toBeArrayOfSize(1);
            });
        });
    });

    describe('NonFungibleToken.CollectionPublic interface methods', () => {
        let testAccount;
        let NftContractAddress;

        beforeEach(async () => {
            NftContractAddress = await initialize();
            testAccount = await getAccountAddress("testAccount");
        });
        afterEach(shutDown);

        describe('deposit() method', () => {
            it('Successfully Deposits a MoonNFT.NFT within an asset collection for another account', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                const code = `
                    import ${MoonNFT} from ${platformAccount}
                    import ${NonFungibleToken} from ${NftContractAddress}

                    transaction(depositAccountAddress: Address) {
                        let minterRef: &${MoonNFT}.NftMinter
                        let collectionPublic: &AnyResource{${NonFungibleToken}.CollectionPublic}

                        prepare(authAccount: AuthAccount) {
                            self.minterRef = authAccount.borrow<&${MoonNFT}.NftMinter>(from: ${MoonNFT}.MINTER_STORAGE_PATH) ??
                                panic("Could not borrow nft minter")

                            self.collectionPublic = getAccount(depositAccountAddress)
                                .getCapability<&{${NonFungibleToken}.CollectionPublic}>(${MoonNFT}.PUBLIC_COLLECTION_PUBLIC_PATH)
                                .borrow() ?? panic("unable to borrow nft receiver capability for recipient")
                        }

                        execute {
                            let nftData1 = ${MoonNFT}.MoonNftData(
                                0,
                                "url",
                                creator: "testCreator",
                                creatorId: 1,
                                metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(nftData1)

                            self.collectionPublic.deposit(token: <- nft1)
                        }
                    }
                `;

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [testAccount]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
                expect(relevantEvents).toBeArrayOfSize(1);
            });
        });

        describe('getIDs() method', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}
                import ${NonFungibleToken} from ${NftContractAddress}

                pub fun main (userAccountAddress: Address) : [UInt64] {

                    let collectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${NonFungibleToken}.CollectionPublic}>(${MoonNFT}.PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver capability for recipient")

                    return collectionPublic.getIDs()
                }
            `;

            it('Accurately fetches all the NFT Ids in a Collection', async () => {
                await addNftReceiverToAccount(testAccount, NftContractAddress);

                let result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );

                expect(result).toBeArrayOfSize(0);

                const nft = await depositNftWithinInitializedAccount(testAccount, false);

                result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );

                expect(result).toBeArrayOfSize(1);
                expect(result).toIncludeSameMembers([nft.id]);
            });
        });

        describe('borrowNFT', () => {
            const code = `
                import ${MoonNFT} from ${platformAccount}
                import ${NonFungibleToken} from ${NftContractAddress}

                pub fun main (userAccountAddress: Address, nftId: UInt64) : UInt64 {

                    let collectionPublic = getAccount(userAccountAddress)
                        .getCapability<&{${NonFungibleToken}.CollectionPublic}>(${MoonNFT}.PUBLIC_COLLECTION_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver capability for recipient")

                    return collectionPublic.borrowNFT(id: nftId)!.id
                }
            `;

            it('Should allow you to borrow an Nft with a valid ID', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount, true, NftContractAddress);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount, nft.id]})
                );

                expect(result).toBe(nft.id);
            });

            it('Throws when trying to borrow an invalid NFT', async () => {
                shallThrow(
                    executeScript({ code, args: [testAccount, 5000]})
                );
            });
        });
    });
});
