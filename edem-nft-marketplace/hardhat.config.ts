import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      allowUnlimitedContractSize: true,
      optimizer: {
        enabled: true,
        runs: 88888,
      },
    },
  },
  gasReporter: {
    currency: "CHF",
    gasPrice: 21,
  },
};

export default config;
