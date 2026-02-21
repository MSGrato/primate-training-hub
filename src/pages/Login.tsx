import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrimateLogo } from "@/components/PrimateLogo";
import { useToast } from "@/hooks/use-toast";
import { ContactFooter } from "@/components/ContactFooter";

const DEMO_ACCOUNTS = [
  { label: "Employee", email: "employee@uw.edu", password: "demo1234" },
  { label: "Supervisor", email: "supervisor@uw.edu", password: "demo1234" },
  { label: "Coordinator", email: "coordinator@uw.edu", password: "demo1234" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getErrorMessage = (err: unknown) => {
    return err instanceof Error ? err.message : "Invalid credentials";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard/home");
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-primary">
      <div className="flex flex-1 items-center justify-center">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <PrimateLogo className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">WaNBRC Train</CardTitle>
          <p className="text-sm text-muted-foreground">Training Management System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">NetID / Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="netid@uw.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Try a demo account</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                  className="rounded-md border bg-muted/50 px-2 py-2 text-center text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <div className="font-medium">{account.label}</div>
                  <div className="mt-0.5 truncate opacity-70">{account.email}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Click a role to fill in the credentials, then sign in.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
      <ContactFooter />
    </div>
  );
}
