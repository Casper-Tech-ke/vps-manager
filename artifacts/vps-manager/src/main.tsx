import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

setAuthTokenGetter(() => sessionStorage.getItem("xcm_api_key"));

createRoot(document.getElementById("root")!).render(<App />);
