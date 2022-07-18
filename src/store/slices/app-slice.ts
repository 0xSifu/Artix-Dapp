import { ethers } from "ethers";
import { getAddresses, Networks } from "../../constants";
import { StakingContract, SartixTokenContract, ArtixTokenContract } from "../../abi";
import { setAll } from "../../helpers";
import { createSlice, createSelector, createAsyncThunk } from "@reduxjs/toolkit";
import { JsonRpcProvider, StaticJsonRpcProvider } from "@ethersproject/providers";
import { getMarketPrice, getTokenPrice } from "../../helpers";
import { RootState } from "../store";
import allBonds from "../../helpers/bond";



interface IGetBalancesDashboard {
    address: string;
    networkID: Networks;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
}

export const getBalancesDashboard = createAsyncThunk("app/getBalancesDashboard", async ({ address, networkID, provider }: IGetBalancesDashboard): Promise<IAccountBalancesDashboard> => {
    const addresses = getAddresses(networkID);

    const artixContract = new ethers.Contract(addresses.ARTIX_ADDRESS, ArtixTokenContract, provider);
    const sartixContract = new ethers.Contract(addresses.SARTIX_ADDRESS, SartixTokenContract, provider);
    const circsupply = (await sartixContract.circulatingSupply()) / Math.pow(10, 9);
    const totalsupply = (await artixContract.totalSupply()) / Math.pow(10, 9);
    

    return {
        circsupply,
        totalsupply,
    };
});


interface ILoadAppDetails {
    networkID: Networks;
    provider: StaticJsonRpcProvider | JsonRpcProvider;
}

export const loadAppDetails = createAsyncThunk(
    "app/loadAppDetails",
    //@ts-ignore
    async ({ networkID, provider }: ILoadAppDetails) => {
        const signer = provider.getSigner();

        const mimPrice = getTokenPrice("MIM");
        const addresses = getAddresses(networkID);

        const stakingContract = new ethers.Contract(addresses.STAKING_ADDRESS, StakingContract, signer);
        const currentBlock = await provider.getBlockNumber();
        const currentBlockTime = (await provider.getBlock(currentBlock)).timestamp;
        const sartixContract = new ethers.Contract(addresses.SARTIX_ADDRESS, SartixTokenContract, signer);
        const artixContract = new ethers.Contract(addresses.ARTIX_ADDRESS, ArtixTokenContract, signer);

        const marketPrice = ((await getMarketPrice(networkID, signer)) / Math.pow(10, 9)) * mimPrice;

        const totalSupply = (await artixContract.totalSupply()) / Math.pow(10, 9);
        const circSupply = (await sartixContract.circulatingSupply()) / Math.pow(10, 9);
        const stakingTVL = circSupply * marketPrice;
        const marketCap = totalSupply * marketPrice;

        const tokenBalPromises = allBonds.map(bond => bond.getTreasuryBalance(networkID, provider));
        const tokenBalances = await Promise.all(tokenBalPromises);
        const treasuryBalance = tokenBalances.reduce((tokenBalance0, tokenBalance1) => tokenBalance0 + tokenBalance1, 0);

        const tokenAmountsPromises = allBonds.map(bond => bond.getTokenAmount(networkID, provider));
        const tokenAmounts = await Promise.all(tokenAmountsPromises);
        const rfvTreasury = tokenAmounts.reduce((tokenAmount0, tokenAmount1) => tokenAmount0 + tokenAmount1, 0);

        const timeBondsAmountsPromises = allBonds.map(bond => bond.getTimeAmount(networkID, provider));
        const timeBondsAmounts = await Promise.all(timeBondsAmountsPromises);
        const timeAmount = timeBondsAmounts.reduce((timeAmount0, timeAmount1) => timeAmount0 + timeAmount1, 0);
        const timeSupply = totalSupply - timeAmount;

        const rfv = rfvTreasury / timeSupply;

        const epoch = await stakingContract.epoch();
        const stakingReward = epoch.distribute;
        const circ = await sartixContract.circulatingSupply();
        const stakingRebase = stakingReward / circ;
        const fiveDayRate = Math.pow(1 + stakingRebase, 5 * 3) - 1;
        const stakingAPY = Math.pow(1 + stakingRebase, 365 * 3) - 1;

        const currentIndex = await stakingContract.index();
        const nextRebase = epoch.endTime;

        const treasuryRunway = rfvTreasury / circSupply;
        const runway = Math.log(treasuryRunway) / Math.log(1 + stakingRebase) / 3;

        return {
            currentIndex: Number(ethers.utils.formatUnits(currentIndex, "gwei")) / 4.5,
            totalSupply,
            marketCap,
            currentBlock,
            circSupply,
            fiveDayRate,
            treasuryBalance,
            stakingAPY,
            stakingTVL,
            stakingRebase,
            marketPrice,
            currentBlockTime,
            nextRebase,
            rfv,
            runway,
        };
    },
);

const initialState = {
    loading: true,
};

export interface IAppSlice {
    loading: boolean;
    stakingTVL: number;
    marketPrice: number;
    marketCap: number;
    circSupply: number;
    circsupply: number;
    currentIndex: string;
    currentBlock: number;
    currentBlockTime: number;
    fiveDayRate: number;
    treasuryBalance: number;
    stakingAPY: number;
    stakingRebase: number;
    networkID: number;
    nextRebase: number;
    totalSupply: number;
    totalsupply: number;
    rfv: number;
    runway: number;
}

const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        fetchAppSuccess(state, action) {
            setAll(state, action.payload);
        },
    },
    extraReducers: builder => {
        builder
            .addCase(loadAppDetails.pending, (state, action) => {
                state.loading = true;
            })
            .addCase(loadAppDetails.fulfilled, (state, action) => {
                setAll(state, action.payload);
                state.loading = false;
            })
            .addCase(loadAppDetails.rejected, (state, { error }) => {
                state.loading = false;
                console.log(error);
            })
            .addCase(getBalancesDashboard.pending, state => {
                state.loading = true;
            })
            .addCase(getBalancesDashboard.fulfilled, (state, action) => {
                setAll(state, action.payload);
                state.loading = false;
            })
            .addCase(getBalancesDashboard.rejected, (state, { error }) => {
                state.loading = false;
                console.log(error);
            });
    },
});

const baseInfo = (state: RootState) => state.app;

export default appSlice.reducer;

export const { fetchAppSuccess } = appSlice.actions;

export const getAppState = createSelector(baseInfo, app => app);
