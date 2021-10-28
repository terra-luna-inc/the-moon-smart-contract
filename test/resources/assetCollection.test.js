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

const mintThenDepositNfts = async () => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction() {
            let minterRef: &${TheMoonNFTContract}.NftMinter
            let collectionRef: &${TheMoonNFTContract}.AssetCollection

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                    panic("Could not borrow asset collection")
            }

            execute {
                let nftData1 = ${TheMoonNFTContract}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator",
                    creatorId: 1,
                    metadata: {}
                )
                let nftData2 = ${TheMoonNFTContract}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator2",
                    creatorId: 2,
                    metadata: {}
                )
                let nftData3 = ${TheMoonNFTContract}.MoonNftData(
                    0,
                    "url",
                    creator: "testCreator3",
                    creatorId: 3,
                    metadata: {}
                )

                let nft1 <- self.minterRef.mintNFT(nftData1)
                let nft2 <- self.minterRef.mintNFT(nftData2)
                let nft3 <- self.minterRef.mintNFT(nftData3)

                self.collectionRef.depositNfts(tokens: <- [ <- nft1, <- nft2, <- nft3 ])
            }
        }
    `;

    const result = await sendTransaction({ code, signers: [platformAccount]});

    const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");

    return relevantEvents[0]; // returns [MoonNftData]
};

const createThenDepositPacks = async () => {
    const code = `
        import ${TheMoonNFTContract} from ${platformAccount}

        transaction() {
            let minterRef: &${TheMoonNFTContract}.NftMinter
            let collectionRef: &${TheMoonNFTContract}.AssetCollection

            prepare(authAccount: AuthAccount) {
                self.minterRef = authAccount.borrow<&${TheMoonNFTContract}.NftMinter>(from: ${TheMoonNFTContract}.MINTER_STORAGE_PATH) ??
                    panic("Could not borrow nft minter")

                self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                    panic("Could not borrow asset collection")
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
                        "url2",
                        creator: "testCreator1",
                        creatorId: 1,
                        metadata: {}
                    ),
                    TheMoonNFTContract.MoonNftData(
                        0,
                        "url3",
                        creator: "testCreator1",
                        creatorId: 1,
                        metadata: {}
                    )
                ]

                let inputData2 : [TheMoonNFTContract.MoonNftData] = [
                    TheMoonNFTContract.MoonNftData(
                        0,
                        "url1",
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
                    ),
                    TheMoonNFTContract.MoonNftData(
                        0,
                        "url3",
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
                    "preview_url",
                    title: "packTitle1",
                    creator: "testCreator1",
                    creatorId: 1
                )

                let packData2 = TheMoonNFTContract.MoonNftPackData(
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

describe('AssetCollection resource and NftReciever resource interface', () => {
    describe('AssetCollection resource methods (Methods not implemented from NftReciever)', () => {
        beforeEach(initialize);
        afterEach(shutDown);

        describe('withdrawNft() method', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(nftId: UInt64) {
                    let collectionRef: &${TheMoonNFTContract}.AssetCollection

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
                            panic("Could not borrow asset collection")
                    }

                    execute {
                        let nft <- self.collectionRef.withdrawNft(id: nftId)

                        destroy nft
                    }
                }
            `;

            it('Successfully withdraws a MoonNft that exists with Asset Collection', async () => {
                const firstNft = await mintThenDepositNfts();

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [firstNft.id]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_NftWithdrawn")

                expect(relevantEvents).toBeArrayOfSize(1);
                expect(relevantEvents).toIncludeSameMembers([firstNft]);
            });

            it('Throws when trying to withdraw a MoonNftPack that doesnt exist within asset collection', async () => {
                await mintThenDepositNfts();

                const result = await shallRevert(
                    sendTransaction({ code, signers: [platformAccount], args: [0]})
                );
            });
        });

        describe('withdrawPack() method', () => {
            const withdrawTransactionCode = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction(packId: UInt64) {
                    let collectionRef: &${TheMoonNFTContract}.AssetCollection

                    prepare(authAccount: AuthAccount) {
                        self.collectionRef = authAccount.borrow<&${TheMoonNFTContract}.AssetCollection>(from: ${TheMoonNFTContract}.ASSET_COLLECTION_STORAGE_PATH) ??
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

    describe('NftReciever interface methods', () => {
        let testAccount;

        beforeEach(async () => {
            await initialize();
            testAccount = await getAccountAddress("testAccount");
        });
        afterEach(shutDown);

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

        const depositNftWithinInitializedAccount = async (account, initializeAccount = true) => {
            if (initializeAccount) {
                await addNftReceiverToAccount(account);
            }

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
        }

        const depositPackWithinInitializedAccount = async (account, initializeAccount = true) => {
            if (initializeAccount) {
                await addNftReceiverToAccount(account);
            }

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
                                "url2",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            ),
                            TheMoonNFTContract.MoonNftData(
                                0,
                                "url3",
                                creator: "testCreator1",
                                creatorId: 1,
                                metadata: {}
                            )
                        ]

                        let nfts1 <- self.minterRef.bulkMintNfts(inputData1)

                        let packData1 = TheMoonNFTContract.MoonNftPackData(
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

        describe('depositNft() method', () => {
            it('Successfully Deposits a MoonNft within an asset collection for another account that has nft receiver capability', async () => {
                const testUserAccount = await getAccountAddress("testUserAccount");
                await addNftReceiverToAccount(testUserAccount);

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

                const result = await shallPass(
                    sendTransaction({ code, signers: [platformAccount], args: [testUserAccount]})
                );

                const relevantEvents = getTransactionEventData(result, "AssetCollection_MoonNftDeposit");
                expect(relevantEvents).toBeArrayOfSize(1);
            });
        });

        describe('depositNfts() method', () => {
            it('Successfully Deposits a MoonNfts within an asset collection for another account that has nft receiver capability', async () => {
                const testUserAccount = await getAccountAddress("testUserAccount");
                await addNftReceiverToAccount(testUserAccount);

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

                            let nftData2 = ${TheMoonNFTContract}.MoonNftData(
                                0,
                                "url",
                                creator: "testCreator2",
                                creatorId: 2,
                                metadata: {}
                            )

                            let nft1 <- self.minterRef.mintNFT(nftData1)
                            let nft2 <- self.minterRef.mintNFT(nftData2)

                            self.recipientNftReceiver.depositNfts(tokens: <- [<- nft1, <- nft2])
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
                await addNftReceiverToAccount(testUserAccount);

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
                                    "url2",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                ),
                                TheMoonNFTContract.MoonNftData(
                                    0,
                                    "url3",
                                    creator: "testCreator1",
                                    creatorId: 1,
                                    metadata: {}
                                )
                            ]

                            let nfts1 <- self.minterRef.bulkMintNfts(inputData1)

                            let packData1 = TheMoonNFTContract.MoonNftPackData(
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
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, nftId: UInt64) : Bool {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.nftIdExists(nftId)
                }
            `;

            it('Returns true when checking to see if a MoonNft in the asset collection exists', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, nft.id]})
                );

                expect(exists).toBeTrue();
            });

            it('Returns false when checking to see if a MoonNft in the asset collection does not exists', async () => {
                await depositNftWithinInitializedAccount(testAccount);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, 0]})
                );

                expect(exists).toBeFalse();
            });
        });

        describe('packIdExists', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, packId: UInt64) : Bool {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.packIdExists(packId)
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
                await depositNftWithinInitializedAccount(testAccount);

                const exists = await shallResolve(
                    executeScript({ code, args: [testAccount, 0]})
                );

                expect(exists).toBeFalse();
            });

        });

        describe('getNftIds() method', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [UInt64] {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getNftIds()
                }
            `;

            it('Returns an empty array when no MoonNfts have been deposited', async () => {
                await addNftReceiverToAccount(testAccount);

                const nftIds = await (
                    executeScript({ code, args: [testAccount] })
                );

                expect(nftIds).toBeArrayOfSize(0);
            });

            it('Returns a accurate array of nft ids when MoonNfts have been deposited', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount);

                const nftIds = await (
                    executeScript({ code, args: [testAccount] })
                );

                expect(nftIds).toIncludeSameMembers([nft.id]);
            });
        });

        describe('getNftData() method', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, id: UInt64) : ${TheMoonNFTContract}.MoonNftData {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getNftData(id: id)
                }
            `;

            it('Returns MoonNftData for a MoonNft that exists', async () => {
                const nft = await depositNftWithinInitializedAccount(testAccount);

                const nftDataResult = await shallResolve(
                    executeScript({ code, args: [testAccount, nft.id]})
                );

                expect(nftDataResult).toMatchObject(nft);
            });

            it('Throws when trying to get MoonNftData for a MoonNft that does not exist', async () => {
                await depositNftWithinInitializedAccount(testAccount);

                const nftDataResult = await shallThrow(
                    executeScript({ code, args: [testAccount, 0]})
                );
            });
        });

        describe('getDataForAllNfts() method', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [${TheMoonNFTContract}.MoonNftData] {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getDataForAllNfts()
                }
            `;

            it('Gets data for all MoonNfts that exist within the asset collection', async () => {
                const firstNft = await depositNftWithinInitializedAccount(testAccount);

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
                await addNftReceiverToAccount(testAccount);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toBeArrayOfSize(0);
            });
        });

        describe('getNftPackIds() method', () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [UInt64] {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getNftPackIds()
                }
            `;

            it('Returns an empty array when no MoonNfts have been deposited', async () => {
                await addNftReceiverToAccount(testAccount);

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
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address, id: UInt64) : ${TheMoonNFTContract}.MoonNftPackData {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getNftPackData(id: id)
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
                import ${TheMoonNFTContract} from ${platformAccount}

                pub fun main (userAccountAddress: Address) : [${TheMoonNFTContract}.MoonNftPackData] {

                    let nftReceiver = getAccount(userAccountAddress)
                        .getCapability<&{${TheMoonNFTContract}.NftReceiver}>(${TheMoonNFTContract}.NFT_RECEIVER_PUBLIC_PATH)
                        .borrow() ?? panic("unable to borrow nft receiver")

                    return nftReceiver.getDataForAllPacks()
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
                await addNftReceiverToAccount(testAccount);

                const result = await shallResolve(
                    executeScript({ code, args: [testAccount]})
                );
                expect(result).toBeArrayOfSize(0);
            });
        });
    });
});
