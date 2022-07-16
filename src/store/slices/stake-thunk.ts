import { ethers } from "ethers";
import { getAddresses } from "../../constants";
import { StakingHelperContract, ArtixTokenContract, SartixTokenContract, StakingContract } from "../../abi";
import { clearPendingTxn, fetchPendingTxns, getStakingTypeText } from "./pending-txns-slice";
import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchAccountSuccess, getBalances } from "./account-slice";
import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { Networks } from "../../constants/blockchain";
import { warning, success, info, error } from "../../store/slices/messages-slice";
import { messages } from "../../constants/messages";
import { getGasPrice } from "../../helpers/get-gas-price";
import { metamaskErrorWrap } from "../../helpers/metamask-error-wrap";
import { sleep } from "../../helpers";

interface IChangeApproval {
    token: string;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
    address: string;
    networkID: Networks;
}

export const changeApproval = createAsyncThunk("stake/changeApproval", async ({ token, provider, address, networkID }: IChangeApproval, { dispatch }) => {
    if (!provider) {
        dispatch(warning({ text: messages.please_connect_wallet }));
        return;
    }
    const addresses = getAddresses(networkID);

    const signer = provider.getSigner();
    const artixContract = new ethers.Contract(addresses.ARTIX_ADDRESS, ArtixTokenContract, signer);
    const sartixContract = new ethers.Contract(addresses.SARTIX_ADDRESS, SartixTokenContract, signer);

    let approveTx;
    try {
        const gasPrice = await getGasPrice(provider);

        if (token === "artix") {
            approveTx = await artixContract.approve(addresses.STAKING_HELPER_ADDRESS, ethers.constants.MaxUint256, { gasPrice });
        }

        if (token === "sartix") {
            approveTx = await sartixContract.approve(addresses.STAKING_ADDRESS, ethers.constants.MaxUint256, { gasPrice });
        }

        const text = "Approve " + (token === "artix" ? "Staking" : "Unstaking");
        const pendingTxnType = token === "artix" ? "approve_staking" : "approve_unstaking";

        dispatch(fetchPendingTxns({ txnHash: approveTx.hash, text, type: pendingTxnType }));
        await approveTx.wait();
        dispatch(success({ text: messages.tx_successfully_send }));
    } catch (err: any) {
        return metamaskErrorWrap(err, dispatch);
    } finally {
        if (approveTx) {
            dispatch(clearPendingTxn(approveTx.hash));
        }
    }

    await sleep(2);

    const stakeAllowance = await artixContract.allowance(address, addresses.STAKING_HELPER_ADDRESS);
    const unstakeAllowance = await sartixContract.allowance(address, addresses.STAKING_ADDRESS);

    return dispatch(
        fetchAccountSuccess({
            staking: {
                artixStake: Number(stakeAllowance),
                sartixUnstake: Number(unstakeAllowance),
            },
        }),
    );
});

interface IChangeStake {
    action: string;
    value: string;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
    address: string;
    networkID: Networks;
}

export const changeStake = createAsyncThunk("stake/changeStake", async ({ action, value, provider, address, networkID }: IChangeStake, { dispatch }) => {
    if (!provider) {
        dispatch(warning({ text: messages.please_connect_wallet }));
        return;
    }
    const addresses = getAddresses(networkID);
    const signer = provider.getSigner();
    const staking = new ethers.Contract(addresses.STAKING_ADDRESS, StakingContract, signer);
    const stakingHelper = new ethers.Contract(addresses.STAKING_HELPER_ADDRESS, StakingHelperContract, signer);

    let stakeTx;
    // let claimTx

    try {
        const gasPrice = await getGasPrice(provider);

        if (action === "stake") {
            stakeTx = await stakingHelper.stake(ethers.utils.parseUnits(value, "gwei"));
        } else {
            stakeTx = await staking.unstake(ethers.utils.parseUnits(value, "gwei"), true, { gasPrice });
        }
        const pendingTxnType = action === "stake" ? "staking" : "unstaking";
        dispatch(fetchPendingTxns({ txnHash: stakeTx.hash, text: getStakingTypeText(action), type: pendingTxnType }));
        await stakeTx.wait();
        dispatch(success({ text: messages.tx_successfully_send }));
    } catch (err: any) {
        return metamaskErrorWrap(err, dispatch);
    } finally {
        if (stakeTx) {
            dispatch(clearPendingTxn(stakeTx.hash));
        }
    }
    dispatch(info({ text: messages.your_balance_update_soon }));
    await sleep(6);
    await dispatch(getBalances({ address, networkID, provider }));
    dispatch(info({ text: messages.your_balance_updated }));
    return;
});

interface ClaimWarmupPayload {
  provider: JsonRpcProvider;
  address: string;
  networkID: number;
}

export const claimWarmup = createAsyncThunk(
  'stake/claimWarmup',
  async ({ provider, address, networkID }: ClaimWarmupPayload, { dispatch }) => {
    if (!provider) {
      alert('Please connect your wallet!');
      return;
    }
    const addresses = getAddresses(networkID);
    const signer = provider.getSigner();
    const staking = new ethers.Contract(addresses.STAKING_ADDRESS, StakingContract, signer);

    let tx;
    try {
      tx = await staking.claim(address);
    //   console.log("test");
      dispatch(
        fetchPendingTxns({
          txnHash: tx.hash,
          text: 'CLAIMING',
          type: 'claimWarmup',
        }),
      );
      await tx.wait();
      
    } catch (error: any) {
      if (error.code === -32603 && error.message.indexOf('ds-math-sub-underflow') >= 0) {
        alert('You may be trying to stake more than your balance! Error code: 32603. Message: ds-math-sub-underflow');
      } else {
        alert(error.message);
      }
      return;
    } finally {
      if (tx) {
        dispatch(clearPendingTxn(tx.hash));
      }
    }
    dispatch(getBalances({ address, networkID, provider }));
    return;
  },
);
