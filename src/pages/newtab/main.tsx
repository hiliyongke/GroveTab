import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.less";
import "./styles/app-shell.less";

createRoot(document.getElementById("root")!).render(<App />);
