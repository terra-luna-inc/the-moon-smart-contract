import 'regenerator-runtime/runtime';
import path from "path";
import {
    init,
    emulator,
    deployContractByName,
    getAccountAddress,
    shallPass,
    sendTransaction,
    shallRevert,
} from "flow-js-testing";
import { getTransactionEventName, initializePlatformAccount } from '../testHelpers';

jest.setTimeout(10000);

const platformAccountName = "PlatformAccount";
const TheMoonNFTContract = "TheMoonNFTContract";

const deployNftContract = async (platformAccount) => {
    await deployContractByName({
        to: platformAccount,
        name: TheMoonNFTContract,
    });
}

describe('NftMinter', () => {
    let platformAccount;

    beforeEach(async () => {
        const basePath = path.resolve(__dirname, "../../cadence");
        const port = 8080;

        await init(basePath, {port});
        await emulator.start(port);

        platformAccount = await initializePlatformAccount();
        await deployNftContract(platformAccount);
    });

    afterEach(async () => {
        return await emulator.stop();
    })

    describe('NftMinter access', () => {
        it(`Allows only the account that deployed ${TheMoonNFTContract} to access the NftMinter`, async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {}
                }
            `;

            const signers = [platformAccount];

            await shallPass(
                sendTransaction({ code, signers })
            );
        });

        it(`Throws if the account that didn't deploy the Nft contract tries to access the NftMinter`, async () => {
            const testAccount = await getAccountAddress("Test");

            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {}
                }
            `;

            const signers = [testAccount];

            await shallRevert(
                sendTransaction({ code, signers })
            )
        });
    })

    describe('mintNFT() function', () => {
        it(`Successfully mints a MoonNft`, async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nftData = TheMoonNFTContract.MoonNftData(
                            0,
                            "url",
                            creator: "testCreator",
                            creatorId: 1,
                            metadata: {}
                        )

                        let nft <- self.minterRef.mintNFT(nftData)

                        destroy nft
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallPass(
                sendTransaction({ code, signers })
            );

            const relevantEvents = txResult.events.filter(event => getTransactionEventName(event.type) ===  "NftMinter_MoonNftMinted");

            expect(relevantEvents.length).toBe(1);
        });

        it('Fails to mint a MoonNft when the inputs are invalid', async () => {
            const signers = [platformAccount];

            // second parameter of MoonNftData is empty string
            let code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nftData = TheMoonNFTContract.MoonNftData(
                            0,
                            "",
                            creator: "testCreator",
                            creatorId: 1,
                            metadata: {}
                        )

                        let nft <- self.minterRef.mintNFT(nftData)

                        destroy nft
                    }
                }
            `;

            await shallRevert(
                sendTransaction({ code, signers })
            );

            // third parameter is empty string. This should be invalid
            code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nftData = TheMoonNFTContract.MoonNftData(
                            0,
                            "url",
                            creator: "",
                            creatorId: 1,
                            metadata: {}
                        )

                        let nft <- self.minterRef.mintNFT(nftData)

                        destroy nft
                    }
                }
            `;

            await shallRevert(
                sendTransaction({ code, signers })
            );

            // fourth parameter "creatorId" is 0. This should be invalid
            code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nftData = TheMoonNFTContract.MoonNftData(
                            0,
                            "url",
                            creator: "testCreator",
                            creatorId: 0,
                            metadata: {}
                        )

                        let nft <- self.minterRef.mintNFT(nftData)

                        destroy nft
                    }
                }
            `;

            await shallRevert(
                sendTransaction({ code, signers })
            );
        });
    });

    describe('bulkMintNfts() function', () => {
        it('Successfully bulk mints a collection of nfts when valid input data is supplied', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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

                        destroy nfts
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallPass(
                sendTransaction({ code, signers })
            );

            const relevantEvents = txResult.events.filter(event => getTransactionEventName(event.type) ===  "NftMinter_MoonNftMinted");

            expect(relevantEvents.length).toBe(2);
        });

        it('Fails to bulk mint a collection of nfts when an empty collection is supplied as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nfts <- self.minterRef.bulkMintNfts([])

                        destroy nfts
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to bulk mint a collection of nfts when invalid nft data is supplied as an argument ', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let inputData : [TheMoonNFTContract.MoonNftData] = []
                        inputData.append(
                            TheMoonNFTContract.MoonNftData(
                                0,
                                "",
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

                        destroy nfts
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });
    });

    describe('createNftPack() function', () => {
        it('Successfully creates a MoonNftPack with valid inputs supplied', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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

                        let nftPack <- self.minterRef.createNftPack(<- nfts, packData)

                        destroy nftPack
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallPass(
                sendTransaction({ code, signers })
            );

            const relevantEvents = txResult.events.filter(event => getTransactionEventName(event.type) ===  "NftMinter_MoonNftPackCreated");

            expect(relevantEvents.length).toBe(1);
        });

        it('Fails to create a MoonNftPack when an empty collection of Nfts is supplied as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let nftCollection : @[MoonNft] <- []

                        let nftPack <- self.minterRef.createNftPack(<- nftCollection, packData)

                        destroy nftPack
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to creates a MoonNftPack when invalid pack data is supplied as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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
                            "",
                            title: "packTitle",
                            creator: "packCreator",
                            creatorId: 1
                        )

                        let nftPack <- self.minterRef.createNftPack(<- nfts, packData)

                        destroy nftPack
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });
    });

    describe('createNftPackRelease() function', () => {
        it('Successfully creates a MoonNftRelease when all valid arguments are passed in', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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

                        let packRlease <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts, packData, price: 20)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallPass(
                sendTransaction({ code, signers })
            );

            const relevantEvents = txResult.events.filter(event => getTransactionEventName(event.type) ===  "NftMinter_MoonNftPackReleaseCreated");

            expect(relevantEvents.length).toBe(1);
        });

        it('Fails to create a MoonNftRelease when an empty collection of nfts is passed as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
                    }

                    execute {
                        let packData = TheMoonNFTContract.MoonNftPackData(
                            0,
                            [],
                            "url",
                            title: "packTitle",
                            creator: "packCreator",
                            creatorId: 1
                        )

                        let packRlease <- self.minterRef.createNftPackRelease(id: "release1", <- {}, packData, price: 20)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to create a MoonNftRelease when an invalid release id is passed as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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

                        let packRlease <- self.minterRef.createNftPackRelease(id: "", <- mappingOfNfts, packData, price: 20)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to create a MoonNftRelease when an invalid nft mapping is passed as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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
                            "pack1UUID" : <- nfts,
                            "packUUID2" : <- []
                        }

                        let packRlease <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts, packData, price: 20)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to create a MoonNftRelease when an invalid price is passed as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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
                            "pack1UUID" : <- nfts,
                            "packUUID2" : <- []
                        }

                        let packRlease <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts, packData, price: -1)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });

        it('Fails to create a MoonNftRelease when an invalid release data is passed as an argument', async () => {
            const code = `
                import ${TheMoonNFTContract} from ${platformAccount}

                transaction() {
                    let minterRef: &TheMoonNFTContract.NftMinter

                    prepare(authAccount: AuthAccount) {
                        self.minterRef = authAccount.borrow<&TheMoonNFTContract.NftMinter>(from: TheMoonNFTContract.MINTER_STORAGE_PATH) ??
                            panic("Could not borrow nft minter")
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
                            "",
                            title: "",
                            creator: "",
                            creatorId: 1
                        )

                        let mappingOfNfts <- {
                            "pack1UUID" : <- nfts,
                            "packUUID2" : <- []
                        }

                        let packRlease <- self.minterRef.createNftPackRelease(id: "release1", <- mappingOfNfts, packData, price: -1)

                        destroy packRlease
                    }
                }
            `;

            const signers = [platformAccount];

            const txResult = await shallRevert(
                sendTransaction({ code, signers })
            );
        });
    });
});
