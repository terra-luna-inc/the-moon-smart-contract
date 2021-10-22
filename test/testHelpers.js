import { getAccountAddress, mintFlow, deployContractByName } from "flow-js-testing";

export const initializePlatformAccount = async (platformAccountName) => {
    platformAccountName = platformAccountName || "PlatformAccount";

    const platformAccount = await getAccountAddress(platformAccountName);
    await mintFlow(platformAccount, "1.0");

    return platformAccount;
}

export const getTransactionEventName = (eventType) => {
    return eventType.split('.').pop();
}

export const getTransactionEventData = (transactionResult, eventType) => {
    const relevantEvents = transactionResult.events.filter(event => getTransactionEventName(event.type) === eventType);

    return relevantEvents.map(event => event.data.data);
}

export const deployNftContract = async (account, contractName) => {
    await deployContractByName({
        to: account,
        name: contractName,
    });
}
