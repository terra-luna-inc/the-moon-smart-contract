import 'regenerator-runtime/runtime';
import path from "path";
import { init, emulator, deployContractByName, getAccountAddress, mintFlow, getContractAddress } from "flow-js-testing";

const platformAccountName = "PlatformAccount";
const NFTAddress = "0xNFTAddress";

describe("Deployment", () => {
    let platformAccount, NftAddressAccount;

    beforeEach(async () => {
      const basePath = path.resolve(__dirname, "../cadence");
      const port = 8080;

      await init(basePath, {port});
      await emulator.start(port);

      platformAccount = await getAccountAddress(platformAccountName);
      NftAddressAccount = await getAccountAddress(NFTAddress);

      await deployContractByName({ to: NftAddressAccount, name: 'NonFungibleToken'});

      await mintFlow(platformAccount, "1.0");

    });

    afterEach(async () => {
        await emulator.stop();
    })

    it('Able to successfully deploy with name MoonNFT', async () => {

        const name = "MoonNFT";
        const to = platformAccount;
        const addressMap = {
            NonFungibleToken: NftAddressAccount
        };

        const result = await deployContractByName({ to, name, addressMap });


        expect(result.status).toBe(4);
        expect(result.errorMessage).toBe('');

        const contractAddress = await getContractAddress(name);
        expect(contractAddress).toBe(platformAccount);
    });
})
