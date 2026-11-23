import { and, count as drizzleCount, eq, SQL } from "drizzle-orm";
import { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, DbExecutor } from "@/db";
import { Loja, lojas } from "@/db/schema";
import { LojistaSessionContext, requireLojistaSession } from "./auth/session";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

export type TenantTable = PgTable & {
  loja_id: AnyPgColumn;
};

export type TenantTableWithId = TenantTable & {
  id: AnyPgColumn;
};

export type TenantInsertValues<TTable extends TenantTable> = Omit<
  TTable["$inferInsert"],
  "loja_id"
> & {
  loja_id?: string;
};

export type TenantUpdateValues<TTable extends TenantTable> = Partial<
  Omit<TTable["$inferInsert"], "id" | "loja_id">
>;

type FindManyOptions = {
  where?: SQL;
  orderBy?: SQL | AnyPgColumn | Array<SQL | AnyPgColumn>;
  limit?: number;
  offset?: number;
};

function validarLojaId(lojaId: string): string {
  if (!lojaId || !UUID_REGEX.test(lojaId)) {
    throw new TenantScopeError(
      `loja_id inválido para escopo multi-tenant: "${lojaId}"`,
    );
  }
  return lojaId;
}

export interface TenantDb {
  readonly lojaId: string;
  scope<TTable extends TenantTable>(table: TTable, extraWhere?: SQL): SQL;
  getLoja(): Promise<Loja | null>;
  findMany<TTable extends TenantTable>(
    table: TTable,
    options?: FindManyOptions,
  ): Promise<Array<TTable["$inferSelect"]>>;
  findFirst<TTable extends TenantTable>(
    table: TTable,
    extraWhere?: SQL,
  ): Promise<TTable["$inferSelect"] | null>;
  findById<TTable extends TenantTableWithId>(
    table: TTable,
    id: string,
  ): Promise<TTable["$inferSelect"] | null>;
  count<TTable extends TenantTable>(
    table: TTable,
    extraWhere?: SQL,
  ): Promise<number>;
  insert<TTable extends TenantTable>(
    table: TTable,
    values: TenantInsertValues<TTable> | Array<TenantInsertValues<TTable>>,
  ): Promise<Array<TTable["$inferSelect"]>>;
  update<TTable extends TenantTable>(
    table: TTable,
    values: TenantUpdateValues<TTable>,
    extraWhere?: SQL,
  ): Promise<Array<TTable["$inferSelect"]>>;
  updateById<TTable extends TenantTableWithId>(
    table: TTable,
    id: string,
    values: TenantUpdateValues<TTable>,
  ): Promise<TTable["$inferSelect"] | null>;
  remove<TTable extends TenantTable>(
    table: TTable,
    extraWhere: SQL,
  ): Promise<Array<TTable["$inferSelect"]>>;
  removeById<TTable extends TenantTableWithId>(
    table: TTable,
    id: string,
  ): Promise<TTable["$inferSelect"] | null>;
  transaction<TResult>(
    fn: (txTenantDb: TenantDb) => Promise<TResult>,
  ): Promise<TResult>;
}

export function createTenantDb(
  lojaId: string,
  executor: DbExecutor = db,
): TenantDb {
  const scopedLojaId = validarLojaId(lojaId);

  function scope<TTable extends TenantTable>(
    table: TTable,
    extraWhere?: SQL,
  ): SQL {
    const base = eq(table.loja_id, scopedLojaId);
    return extraWhere ? (and(base, extraWhere) as SQL) : base;
  }

  return {
    lojaId: scopedLojaId,
    scope,

    async getLoja(): Promise<Loja | null> {
      const [loja] = await executor
        .select()
        .from(lojas)
        .where(eq(lojas.id, scopedLojaId))
        .limit(1);
      return loja ?? null;
    },

    async findMany<TTable extends TenantTable>(
      table: TTable,
      options: FindManyOptions = {},
    ): Promise<Array<TTable["$inferSelect"]>> {
      const baseQuery = executor
        .select()
        .from(table as PgTable)
        .where(scope(table, options.where));

      const orderedQuery = options.orderBy
        ? Array.isArray(options.orderBy)
          ? baseQuery.orderBy(...options.orderBy)
          : baseQuery.orderBy(options.orderBy)
        : baseQuery;

      const limitedQuery =
        typeof options.limit === "number"
          ? orderedQuery.limit(options.limit)
          : orderedQuery;

      const finalQuery =
        typeof options.offset === "number"
          ? limitedQuery.offset(options.offset)
          : limitedQuery;

      return (await finalQuery) as Array<TTable["$inferSelect"]>;
    },

    async findFirst<TTable extends TenantTable>(
      table: TTable,
      extraWhere?: SQL,
    ): Promise<TTable["$inferSelect"] | null> {
      const rows = await executor
        .select()
        .from(table as PgTable)
        .where(scope(table, extraWhere))
        .limit(1);
      return (rows[0] as TTable["$inferSelect"] | undefined) ?? null;
    },

    async findById<TTable extends TenantTableWithId>(
      table: TTable,
      id: string,
    ): Promise<TTable["$inferSelect"] | null> {
      const rows = await executor
        .select()
        .from(table as PgTable)
        .where(scope(table, eq(table.id, id)))
        .limit(1);
      return (rows[0] as TTable["$inferSelect"] | undefined) ?? null;
    },

    async count<TTable extends TenantTable>(
      table: TTable,
      extraWhere?: SQL,
    ): Promise<number> {
      const rows = await executor
        .select({ total: drizzleCount() })
        .from(table as PgTable)
        .where(scope(table, extraWhere));
      return Number(rows[0]?.total ?? 0);
    },

    async insert<TTable extends TenantTable>(
      table: TTable,
      values:
        | TenantInsertValues<TTable>
        | Array<TenantInsertValues<TTable>>,
    ): Promise<Array<TTable["$inferSelect"]>> {
      const list = Array.isArray(values) ? values : [values];
      const scopedValues = list.map((item) => ({
        ...item,
        loja_id: scopedLojaId,
      }));

      const rows = await executor
        .insert(table as PgTable)
        .values(scopedValues as Record<string, unknown>[])
        .returning();

      return rows as Array<TTable["$inferSelect"]>;
    },

    async update<TTable extends TenantTable>(
      table: TTable,
      values: TenantUpdateValues<TTable>,
      extraWhere?: SQL,
    ): Promise<Array<TTable["$inferSelect"]>> {
      const sanitized = { ...(values as Record<string, unknown>) };
      delete sanitized.loja_id;
      delete sanitized.id;

      const rows = await executor
        .update(table as PgTable)
        .set(sanitized)
        .where(scope(table, extraWhere))
        .returning();

      return rows as Array<TTable["$inferSelect"]>;
    },

    async updateById<TTable extends TenantTableWithId>(
      table: TTable,
      id: string,
      values: TenantUpdateValues<TTable>,
    ): Promise<TTable["$inferSelect"] | null> {
      const sanitized = { ...(values as Record<string, unknown>) };
      delete sanitized.loja_id;
      delete sanitized.id;

      const rows = await executor
        .update(table as PgTable)
        .set(sanitized)
        .where(scope(table, eq(table.id, id)))
        .returning();

      return (rows[0] as TTable["$inferSelect"] | undefined) ?? null;
    },

    async remove<TTable extends TenantTable>(
      table: TTable,
      extraWhere: SQL,
    ): Promise<Array<TTable["$inferSelect"]>> {
      const rows = await executor
        .delete(table as PgTable)
        .where(scope(table, extraWhere))
        .returning();

      return rows as Array<TTable["$inferSelect"]>;
    },

    async removeById<TTable extends TenantTableWithId>(
      table: TTable,
      id: string,
    ): Promise<TTable["$inferSelect"] | null> {
      const rows = await executor
        .delete(table as PgTable)
        .where(scope(table, eq(table.id, id)))
        .returning();

      return (rows[0] as TTable["$inferSelect"] | undefined) ?? null;
    },

    async transaction<TResult>(
      fn: (txTenantDb: TenantDb) => Promise<TResult>,
    ): Promise<TResult> {
      return executor.transaction(async (tx) => {
        return fn(createTenantDb(scopedLojaId, tx));
      });
    },
  };
}

export type PanelTenantContext = LojistaSessionContext & {
  tenantDb: TenantDb;
};

export async function getPanelTenantContext(): Promise<PanelTenantContext> {
  const { usuario, loja, impersonando } = await requireLojistaSession();
  return {
    usuario,
    loja,
    impersonando,
    tenantDb: createTenantDb(loja.id),
  };
}
