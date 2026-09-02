import { useEffect, useState } from "react";
import { Form, required, useNotify, useRedirect, useTranslate } from "ra-core";
import { useSetPassword, useSupabaseAccessToken } from "ra-supabase-core";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Layout } from "@/components/supabase/layout";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";

interface SetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export const SetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const access_token = useSupabaseAccessToken({ redirectTo: false });
  const refresh_token = useSupabaseAccessToken({
    parameterName: "refresh_token",
    redirectTo: false,
  });

  const notify = useNotify();
  const redirect = useRedirect();
  const translate = useTranslate();
  const [, { mutateAsync: setPassword }] = useSetPassword();

  useEffect(() => {
    // Check if a code or token_hash parameter is in URL
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.includes("?")
        ? window.location.hash.split("?")[1]
        : "",
    );
    const code = searchParams.get("code") || hashParams.get("code");
    const token_hash =
      searchParams.get("token_hash") || hashParams.get("token_hash");
    const type = searchParams.get("type") || hashParams.get("type") || "invite";

    if (token_hash) {
      getSupabaseClient()
        .auth.verifyOtp({ token_hash, type: type as any })
        .then(({ data, error }) => {
          if (!error && data?.session) {
            setHasSession(true);
          }
          setCheckingSession(false);
        })
        .catch(() => setCheckingSession(false));
      return;
    }

    if (code) {
      getSupabaseClient()
        .auth.exchangeCodeForSession(code)
        .then(({ data, error }) => {
          if (!error && data?.session) {
            setHasSession(true);
          }
          setCheckingSession(false);
        })
        .catch(() => setCheckingSession(false));
      return;
    }

    getSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data?.session) {
          setHasSession(true);
        }
        setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, []);

  const validate = (values: SetPasswordFormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "ra-supabase.validation.password_mismatch",
        confirmPassword: "ra-supabase.validation.password_mismatch",
      };
    }
    return {};
  };

  const hasAuth = Boolean((access_token && refresh_token) || hasSession);

  if (checkingSession && !access_token) {
    return (
      <Layout>
        <p className="text-center text-muted-foreground">
          {translate("ra.page.loading", { _: "Loading..." })}
        </p>
      </Layout>
    );
  }

  if (!hasAuth && !checkingSession) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Missing access_token, refresh_token, or session for set password",
      );
    }
    return (
      <Layout>
        <p>{translate("ra-supabase.auth.missing_tokens")}</p>
      </Layout>
    );
  }

  const submit = async (values: SetPasswordFormData) => {
    try {
      setLoading(true);
      if (access_token && refresh_token) {
        await setPassword({
          access_token,
          refresh_token,
          password: values.password,
        });
      } else {
        const { error } = await getSupabaseClient().auth.updateUser({
          password: values.password,
        });
        if (error) throw error;
        notify("ra-supabase.set_password.success", {
          type: "success",
          messageArgs: { _: "Password updated successfully" },
        });
        redirect("/");
      }
    } catch (error: any) {
      notify(
        typeof error === "string"
          ? error
          : typeof error === "undefined" || !error.message
            ? "ra.auth.sign_in_error"
            : error.message,
        {
          type: "warning",
          messageArgs: {
            _:
              typeof error === "string"
                ? error
                : error && error.message
                  ? error.message
                  : undefined,
          },
        },
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate("ra-supabase.set_password.new_password", {
            _: "Choose your password",
          })}
        </h1>
      </div>
      <Form
        className="space-y-8"
        onSubmit={submit as any}
        validate={validate as any}
      >
        <TextInput
          label={translate("ra.auth.password", {
            _: "Password",
          })}
          autoComplete="new-password"
          source="password"
          type="password"
          validate={required()}
        />
        <TextInput
          label={translate("crm.auth.confirm_password", {
            _: "Confirm password",
          })}
          source="confirmPassword"
          type="password"
          validate={required()}
        />
        <Button type="submit" className="cursor-pointer" disabled={loading}>
          {translate("ra.action.save")}
        </Button>
      </Form>
    </Layout>
  );
};

SetPasswordPage.path = "set-password";
