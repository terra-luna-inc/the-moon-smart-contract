import { init, emulator, deployContractByName, getAccountAddress, mintFlow, getContractAddress } from "flow-js-testing";

export const initializePlatformAccount = async (platformAccountName) => {
    platformAccountName = platformAccountName || "PlatformAccount";

    const platformAccount = await getAccountAddress(platformAccountName);
    await mintFlow(platformAccount, "1.0");

    return platformAccount;
}

export const stopEmulator = async () => {
    await emulator.stop();
}
