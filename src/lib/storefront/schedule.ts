import type { HorariosFuncionamento } from "@/db/schema";

export type DiaSemana = keyof HorariosFuncionamento;

const WEEKDAY_MAP: Record<string, DiaSemana> = {
  Mon: "seg",
  Tue: "ter",
  Wed: "qua",
  Thu: "qui",
  Fri: "sex",
  Sat: "sab",
  Sun: "dom",
};

export interface StatusHorarioFuncionamento {
  dentroDoHorario: boolean;
  diaSemana: DiaSemana;
  horaAtual: string;
  motivo?: string;
}

export function obterDataHoraBrasilia(agora: Date = new Date()): {
  diaSemana: DiaSemana;
  horaAtual: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(agora);
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hourPart = (parts.find((p) => p.type === "hour")?.value ?? "00").padStart(
    2,
    "0",
  );
  const minutePart = (
    parts.find((p) => p.type === "minute")?.value ?? "00"
  ).padStart(2, "0");

  const diaSemana = WEEKDAY_MAP[weekdayPart] ?? "seg";
  const hora = hourPart === "24" ? "00" : hourPart;
  return {
    diaSemana,
    horaAtual: `${hora}:${minutePart}`,
  };
}

export function verificarHorarioFuncionamento(
  horarios: HorariosFuncionamento | null | undefined,
  agora: Date = new Date(),
): StatusHorarioFuncionamento {
  const { diaSemana, horaAtual } = obterDataHoraBrasilia(agora);

  if (!horarios) {
    return {
      dentroDoHorario: true,
      diaSemana,
      horaAtual,
    };
  }

  const configDia = horarios[diaSemana];
  if (!configDia) {
    return {
      dentroDoHorario: true,
      diaSemana,
      horaAtual,
    };
  }

  if (!configDia.aberto) {
    return {
      dentroDoHorario: false,
      diaSemana,
      horaAtual,
      motivo: "A loja não abre hoje segundo o horário de funcionamento.",
    };
  }

  if (horaAtual < configDia.abre || horaAtual >= configDia.fecha) {
    return {
      dentroDoHorario: false,
      diaSemana,
      horaAtual,
      motivo: `Fora do horário de funcionamento. Atendimento hoje das ${configDia.abre} às ${configDia.fecha}.`,
    };
  }

  return {
    dentroDoHorario: true,
    diaSemana,
    horaAtual,
  };
}
