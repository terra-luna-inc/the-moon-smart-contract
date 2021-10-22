import { getAccountAddress, mintFlow } from "flow-js-testing";

export const initializePlatformAccount = async (platformAccountName) => {
    platformAccountName = platformAccountName || "PlatformAccount";

    const platformAccount = await getAccountAddress(platformAccountName);
    await mintFlow(platformAccount, "1.0");

    return platformAccount;
}

export const getTransactionEventName = (eventType) => {
    return eventType.split('.').pop();
}
