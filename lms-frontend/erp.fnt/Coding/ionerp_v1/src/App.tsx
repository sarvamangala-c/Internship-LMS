import React from "react";
import LoadingOverlay from "react-loading-overlay-ts";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter as Router } from "react-router-dom";

import { ThemeProvider } from "./contexts/ThemeContext";
import { LayoutProvider } from "./contexts/LayoutContext";
import { ModalWithFormProvider } from "./contexts/ModelFormContext";
import { useLoader } from "./contexts/LoaderContext";

import AppRoutes from "./routes/routes";

const App: React.FC = () => {
  const { loading, loadingText } = useLoader();

  return (
    <LoadingOverlay active={loading} spinner text={loadingText}>
      <ThemeProvider>
        <ModalWithFormProvider>
          <Router>
            <LayoutProvider>
              <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                <AppRoutes />

                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                />
              </div>
            </LayoutProvider>
          </Router>
        </ModalWithFormProvider>
      </ThemeProvider>
    </LoadingOverlay>
  );
};

export default App;