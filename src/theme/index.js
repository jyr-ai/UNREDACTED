import { createContext, useContext, createElement } from "react";
import { DARK_THEME } from "./dark.js";

const ThemeCtx = createContext(DARK_THEME);

export const useTheme = () => useContext(ThemeCtx);

export const ThemeProvider = ({ children, theme }) => {
  return createElement(ThemeCtx.Provider, { value: theme }, children);
};

export default ThemeCtx;
