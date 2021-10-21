import 'regenerator-runtime/runtime';
import path from "path";
import { init, emulator, deployContractByName, getAccountAddress, mintFlow, getContractAddress } from "flow-js-testing";

describe("Deployment", () => {
    let PlatformAccount;

    beforeEach(async () => {
      const basePath = path.resolve(__dirname, "../cadence");
      const port = 8080;

      await init(basePath, {port});
      await emulator.start(port);

      // We will deploy our contract to the address that corresponds to "Alice" alias
      PlatformAccount = await getAccountAddress("Alice");
      await getAccountAddress("Alice");

      await mintFlow(PlatformAccount, "1.0");

    });

    afterEach(async () => {
        await emulator.stop();
    })

    test('Able to successfully deploy with name TheMoonNFTContract', async () => {

        const name = "TheMoonNFTContract";
        const to = PlatformAccount;

        const result = await deployContractByName({ to, name });


        expect(result.status).toBe(4);
        expect(result.errorMessage).toBe('');

        const contractAddress = await getContractAddress(name);
        expect(contractAddress).toBe(PlatformAccount);
    });
})
