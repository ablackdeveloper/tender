export * from "react-native-web";
import { deviceNotice } from "./platform";
export const Linking = {
  async openURL() {
    deviceNotice("External links and calls");
  },
  async canOpenURL() {
    return false;
  },
};
