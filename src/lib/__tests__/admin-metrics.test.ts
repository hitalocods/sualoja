import assert from "node:assert/strict";
import test from "node:test";
import {
  calcularDiasRestantesTrial,
  calcularVariacaoPercentual,
  resolveAdminQueryParams,
} from "../admin/metrics";

test("resolveAdminQueryParams sempre exclui dados demo em produção", () => {
  const prodDefault = resolveAdminQueryParams({}, true);
  assert.deepEqual(prodDefault, {
    dias: 30,
    includeDemo: false,
    isProduction: true,
  });

  const prodForceDemo = resolveAdminQueryParams(
    { periodo: "90", demo: "1" },
    true,
  );
  assert.deepEqual(prodForceDemo, {
    dias: 90,
    includeDemo: false,
    isProduction: true,
  });
});

test("resolveAdminQueryParams ativa demo por padrão em dev e permite desligar com demo=0", () => {
  const devDefault = resolveAdminQueryParams({}, false);
  assert.deepEqual(devDefault, {
    dias: 30,
    includeDemo: true,
    isProduction: false,
  });

  const devOff = resolveAdminQueryParams({ periodo: "7", demo: "0" }, false);
  assert.deepEqual(devOff, {
    dias: 7,
    includeDemo: false,
    isProduction: false,
  });

  const invalidPeriodo = resolveAdminQueryParams({ periodo: "365" }, false);
  assert.equal(invalidPeriodo.dias, 30);
});

test("calcularVariacaoPercentual trata zero, crescimento e queda corretamente", () => {
  assert.equal(calcularVariacaoPercentual(0, 0), 0);
  assert.equal(calcularVariacaoPercentual(500, 0), 100);
  assert.equal(calcularVariacaoPercentual(150, 100), 50);
  assert.equal(calcularVariacaoPercentual(75, 100), -25);
});

test("calcularDiasRestantesTrial retorna dias inteiros >= 0 ou null", () => {
  const base = new Date("2026-11-22T12:00:00Z");
  assert.equal(calcularDiasRestantesTrial(null, base), null);
  assert.equal(
    calcularDiasRestantesTrial(new Date("2026-12-06T12:00:00Z"), base),
    14,
  );
  assert.equal(
    calcularDiasRestantesTrial(new Date("2026-11-20T12:00:00Z"), base),
    0,
  );
});
