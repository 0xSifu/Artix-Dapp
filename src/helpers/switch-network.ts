import { Networks } from "../constants/blockchain";

const switchRequest = () => {
    return window.ethereum.request({
        method: "wallet_switchEthereumChain",
        // params: [{ chainId: "0xa86a" }],
        params: [{ chainId: "0xA869" }],
    });
};

const addChainRequest = () => {
    return window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
            {
                chainId: "0xA869",
                chainName: "AVAX FUJI C-CHAIN",
                rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
                blockExplorerUrls: ["https://testnet.snowtrace.io/"],
                nativeCurrency: {
                    name: "AVAX FUJI C-CHAIN",
                    symbol: "AVAX",
                    decimals: 18,
                },
            },
        ],
    });
};
// const addChainRequest = () => {
//     return window.ethereum.request({
//         method: "wallet_addEthereumChain",
//         params: [
//             {
//                 chainId: "0xa86a",
//                 chainName: "Avalanche Mainnet",
//                 rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
//                 blockExplorerUrls: ["https://cchain.explorer.avax.network/"],
//                 nativeCurrency: {
//                     name: "AVAX",
//                     symbol: "AVAX",
//                     decimals: 18,
//                 },
//             },
//         ],
//     });
// };

export const swithNetwork = async () => {
    if (window.ethereum) {
        try {
            await switchRequest();
        } catch (error: any) {
            if (error.code === 4902) {
                try {
                    await addChainRequest();
                    await switchRequest();
                } catch (addError) {
                    console.log(error);
                }
            }
            console.log(error);
        }
    }
};
