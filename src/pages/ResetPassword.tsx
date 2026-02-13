import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrimateLogo } from "@/components/PrimateLogo";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const getErrorMessage = (err: unknown) => {
    return err instanceof Error ? err.message : "Please request a new reset link and try again.";
  };

  useEffect(() => {
    let isMounted = true;

    const syncRecoverySession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setCanReset(Boolean(data.session));
      setCheckingSession(false);
    };

    syncRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setCanReset(Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!hasUppercase || !hasNumber || !hasSymbol) {
      toast({
        variant: "destructive",
        title: "Password is too weak",
        description: "Include at least one uppercase letter, one number, and one symbol.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Please re-enter the same password in both fields.",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Unable to update password",
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <Card className="w-full max-w-md mx-4 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <PrimateLogo className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">Set New Password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use at least 8 characters with an uppercase letter, number, and symbol.
          </p>
        </CardHeader>
        <CardContent>
          {checkingSession ? (
            <p className="text-sm text-muted-foreground text-center">Validating reset link...</p>
          ) : !canReset ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or expired. Request a new one.
              </p>
              <Link to="/forgot-password" className="underline underline-offset-4 text-muted-foreground hover:text-foreground text-sm">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
