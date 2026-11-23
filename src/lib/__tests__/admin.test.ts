import assert from "node:assert/strict";
import test from "node:test";
import { assertNaoImpersonando, AuthError } from "../auth/session";
import {
  signImpersonationToken,
  signSessionToken,
  verifyImpersonationToken,
  verifySessionToken,
} from "../auth/token";
import {
  alterarStatusLojaSchema,
  configuracoesPlataformaSchema,
  parseSlugsReservadosText,
  planoAdminSchema,
  trocarPlanoLojaSchema,
} from "../validators/admin";
import { validarSlug } from "../validators/lojista";

test("tokens JWT de sessão distinguem role admin e lojista", async () => {
  const adminToken = await signSessionToken({
    sub: "11111111-1111-4111-8111-111111111111",
    role: "admin",
  });
  const lojistaToken = await signSessionToken({
    sub: "22222222-2222-4222-8222-222222222222",
    role: "lojista",
  });

  const decodedAdmin = await verifySessionToken(adminToken);
  const decodedLojista = await verifySessionToken(lojistaToken);

  assert.deepEqual(decodedAdmin, {
    sub: "11111111-1111-4111-8111-111111111111",
    role: "admin",
  });
  assert.deepEqual(decodedLojista, {
    sub: "22222222-2222-4222-8222-222222222222",
    role: "lojista",
  });
  assert.equal(await verifySessionToken("token-invalido"), null);
});

test("token de impersonação não aceita token de sessão comum", async () => {
  const sessionToken = await signSessionToken({
    sub: "11111111-1111-4111-8111-111111111111",
    role: "admin",
  });
  const impToken = await signImpersonationToken({
    adminId: "11111111-1111-4111-8111-111111111111",
    lojaId: "33333333-3333-4333-8333-333333333333",
  });

  assert.equal(await verifyImpersonationToken(sessionToken), null);
  assert.deepEqual(await verifyImpersonationToken(impToken), {
    adminId: "11111111-1111-4111-8111-111111111111",
    lojaId: "33333333-3333-4333-8333-333333333333",
  });
});

test("validarSlug respeita slugs reservados vindos da configuração", () => {
  const reservadoCustom = validarSlug("suporte", ["admin", "suporte"]);
  assert.equal(reservadoCustom.ok, false);

  const livre = validarSlug("casa-atelier", ["admin", "suporte"]);
  assert.equal(livre.ok, true);
});

test("planoAdminSchema normaliza taxa percentual e aceita limite ilimitado", () => {
  const parsed = planoAdminSchema.safeParse({
    nome: "Enterprise",
    mensalidade_centavos: 19990,
    limite_produtos: null,
    taxa_fixa_centavos: 0,
    taxa_percentual: "1,25",
    ativo: true,
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.taxa_percentual, "1.25");
    assert.equal(parsed.data.limite_produtos, null);
  }
});

test("schemas de loja e configurações da plataforma validam corretamente", () => {
  assert.equal(
    alterarStatusLojaSchema.safeParse({
      lojaId: "33333333-3333-4333-8333-333333333333",
      status: "bloqueada",
    }).success,
    true,
  );
  assert.equal(
    trocarPlanoLojaSchema.safeParse({
      lojaId: "invalido",
      planoId: "33333333-3333-4333-8333-333333333333",
    }).success,
    false,
  );

  const slugs = parseSlugsReservadosText("admin, api\nlogin; ADMIN");
  assert.deepEqual(slugs, ["admin", "api", "login"]);

  const configOk = configuracoesPlataformaSchema.safeParse({
    nome_plataforma: "MinhaLoja",
    email_suporte: "SUPORTE@MINHALOJA.COM.BR",
    dias_trial: 14,
    slugs_reservados: slugs,
  });
  assert.equal(configOk.success, true);
  if (configOk.success) {
    assert.equal(configOk.data.email_suporte, "suporte@minhaloja.com.br");
  }
});

test("assertNaoImpersonando bloqueia escrita durante impersonação e libera sem impersonação", async () => {
  await assert.doesNotReject(() =>
    assertNaoImpersonando({ impersonando: null }),
  );

  await assert.rejects(
    () =>
      assertNaoImpersonando({
        impersonando: {
          adminId: "11111111-1111-4111-8111-111111111111",
          adminNome: "Admin",
          adminEmail: "admin@minhaloja.com.br",
          lojaId: "33333333-3333-4333-8333-333333333333",
          lojaNome: "Casa Atelier",
          lojaSlug: "casa-atelier",
        },
      }),
    (err: unknown) =>
      err instanceof AuthError &&
      err.status === 403 &&
      err.message === "Modo suporte: somente leitura",
  );
});
