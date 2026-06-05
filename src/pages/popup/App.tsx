/**
 * Popup 入口：主题 + 国际化包裹。
 */

import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import { I18nProvider } from "@/shared/i18n";
import { ErrorBoundary } from "./ErrorBoundary";
import { PopupContent } from "./PopupContent";

function App() {
  return (
    <AntdThemeProvider>
      <I18nProvider>
        <ErrorBoundary>
          <PopupContent />
        </ErrorBoundary>
      </I18nProvider>
    </AntdThemeProvider>
  );
}

export default App;
