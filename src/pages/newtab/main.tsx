import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.module.less";
import "./styles/app-shell.module.less";

createRoot(document.getElementById("root")!).render(<App />);
