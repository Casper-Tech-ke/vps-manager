import { Router as WouterRouter, Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { WelcomeModal } from "@/components/welcome-modal";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import FileManager from "@/pages/file-manager";
import DevPage from "@/pages/dev";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000 },
  },
});

function ThemeSetter() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return null;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#08090d" }}>
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>
      <Footer />
      <WelcomeModal />
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      <Route path="/">
        <ProtectedLayout>
          <HomePage />
        </ProtectedLayout>
      </Route>

      <Route path="/files">
        <ProtectedLayout>
          <FileManager />
        </ProtectedLayout>
      </Route>

      <Route path="/terminal">
        <ProtectedLayout>
          <FileManager initialPanel="terminal" />
        </ProtectedLayout>
      </Route>

      <Route path="/dev">
        <ProtectedLayout>
          <DevPage />
        </ProtectedLayout>
      </Route>

      <Route>
        <ProtectedLayout>
          <NotFound />
        </ProtectedLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeSetter />
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
