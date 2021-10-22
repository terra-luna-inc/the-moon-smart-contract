import 'regenerator-runtime/runtime';
import path from "path";
import { init, emulator, deployContractByName, getAccountAddress, mintFlow, getContractAddress } from "flow-js-testing";

const platformAccountName = "PlatformAccount";

describe("Deployment", () => {
    let platformAccount;

    beforeEach(async () => {
      const basePath = path.resolve(__dirname, "../cadence");
      const port = 8080;

      await init(basePath, {port});
      await emulator.start(port);

      platformAccount = await getAccountAddress(platformAccountName);
      await getAccountAddress(platformAccountName);

      await mintFlow(platformAccount, "1.0");

    });

    afterEach(async () => {
        await emulator.stop();
    })

    it('Able to successfully deploy with name TheMoonNFTContract', async () => {

        const name = "TheMoonNFTContract";
        const to = platformAccount;

        const result = await deployContractByName({ to, name });


        expect(result.status).toBe(4);
        expect(result.errorMessage).toBe('');

        const contractAddress = await getContractAddress(name);
        expect(contractAddress).toBe(platformAccount);
    });
})
