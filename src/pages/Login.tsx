import { useRef, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { LoginBrandPill, LoginVisualPanel } from "@/components/auth/login-visual-panel";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { brand } from "@/lib/brand";

export default function LoginPage() {
  const navigate = useNavigate();
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [showMapOnMobile, setShowMapOnMobile] = useState(false);

  const loginM = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: () => {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSignUpMode) {
      toast.info("Admin accounts are provisioned by your organization.");
      return;
    }
    loginM.mutate();
  }

  function toggleMobileMap() {
    setShowMapOnMobile((prev) => {
      const next = !prev;
      if (next) {
        mapPanelRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return next;
    });
  }

  return (
    <div className="login-page flex min-h-screen items-center justify-center p-3 sm:p-6 md:p-10">
      <div className="login-shell flex min-h-[720px] w-full max-w-[1240px] flex-col overflow-hidden rounded-[36px] lg:flex-row lg:items-stretch">
        <div className="relative z-10 flex w-full flex-col justify-between p-6 sm:p-10 md:p-12 lg:w-1/2 lg:min-w-0 lg:shrink-0">
          <div className="flex items-center justify-between">
            <LoginBrandPill />
            <button type="button" onClick={toggleMobileMap} className="login-mobile-toggle lg:hidden">
              <MapPin className="h-3.5 w-3.5" />
              {showMapOnMobile ? "Show form" : "Show map"}
            </button>
          </div>

          <div className="mx-auto my-8 w-full max-w-md">
            <div className="mb-8 text-center sm:text-left">
              <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {isSignUpMode ? `Create a ${brand.name} account` : `Welcome back to ${brand.name}`}
              </h1>
              <p className="text-xs leading-relaxed sm:text-sm" style={{ color: "var(--login-text-muted)" }}>
                {isSignUpMode
                  ? "Sign up and get 30 days free trial for your logistics fleet."
                  : "Sign in to access your tracking dashboard and manage assets."}
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignUpMode ? (
                <div>
                  <label className="login-label">Username / Fleet ID</label>
                  <input type="text" placeholder="Enter your name or fleet code" className="login-input" />
                </div>
              ) : null}

              <div>
                <label className="login-label" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="login-input"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between px-3">
                  <label className="login-label mb-0" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-semibold underline underline-offset-2"
                    style={{ color: "var(--login-text-muted)" }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="login-input pr-12 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-4 -translate-y-1/2 p-1"
                    style={{ color: "var(--login-text-muted)" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={loginM.isPending} className="login-btn-primary disabled:opacity-70">
                  {loginM.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authenticating fleet…
                    </>
                  ) : (
                    <span>{isSignUpMode ? "Create free account" : "Sign in"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div
            className="border-t pt-4 text-xs font-semibold"
            style={{ borderColor: "var(--login-border)", color: "var(--login-text-muted)" }}
          >
            {isSignUpMode ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUpMode((v) => !v)}
              className="ml-1 font-bold underline"
              style={{ color: "var(--login-text)" }}
            >
              {isSignUpMode ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>

        <div
          ref={mapPanelRef}
          className={`w-full lg:flex lg:w-1/2 lg:min-w-0 lg:shrink-0 lg:p-2 ${showMapOnMobile ? "block" : "hidden lg:flex"}`}
        >
          <LoginVisualPanel />
        </div>
      </div>

      {forgotOpen ? (
        <div className="login-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="login-modal relative w-full max-w-md rounded-3xl p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: "var(--login-text-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-6 text-center">
              <div className="login-modal-icon mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-lg">
                <KeyRound className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold">Reset fleet password</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--login-text-muted)" }}>
                Enter your registered email address to receive password recovery instructions.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setForgotOpen(false);
                toast.success("If an account exists, a recovery link will be sent.");
              }}
            >
              <div>
                <label className="login-label">Registered work email</label>
                <input type="email" required placeholder="dispatcher@company.com" className="login-input" />
              </div>
              <button type="submit" className="login-btn-primary">
                Send reset link
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
