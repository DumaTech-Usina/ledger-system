export class Money {
  private static readonly SCALE = 2n; // 2 casas decimais fixas (NUMERIC(18,2))
  private static readonly SCALE_FACTOR = 10n ** Money.SCALE;

  private constructor(
    private readonly units: bigint, // valor em menor unidade (scale 4)
    public readonly currency: string,
  ) {
    if (units < 0n) {
      throw new Error("Money cannot be negative");
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Invalid currency format (must be ISO-4217)");
    }
  }

  // ===============================
  // FACTORIES
  // ===============================

  static zero(currency: string = "BRL"): Money {
    return new Money(0n, currency);
  }

  /**
   * Cria a partir de string decimal segura.
   * Aceita até 4 casas decimais.
   * Ex: "10", "10.5", "10.50", "10.1234"
   */
  static fromDecimal(amount: string, currency: string): Money {
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
      throw new Error(
        "Invalid decimal format (max 2 decimal places, positive only)",
      );
    }

    const [integerPart, decimalPartRaw] = amount.split(".");

    const decimalPart = (decimalPartRaw ?? "").padEnd(Number(Money.SCALE), "0");

    const units =
      BigInt(integerPart) * Money.SCALE_FACTOR + BigInt(decimalPart);

    return new Money(units, currency);
  }

  /**
   * Cria diretamente da menor unidade (já escalado)
   */
  static fromUnits(units: bigint, currency: string): Money {
    return new Money(units, currency);
  }

  // ===============================
  // OPERAÇÕES
  // ===============================

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.units + other.units, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);

    if (other.units > this.units) {
      throw new Error("Money subtraction would result in negative value");
    }

    return new Money(this.units - other.units, this.currency);
  }

  equals(other: Money): boolean {
    return this.units === other.units && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.units > other.units;
  }

  // ===============================
  // SERIALIZAÇÃO CANÔNICA
  // ===============================

  /** Returns the raw scaled integer used for persistence (e.g. bigint column). */
  toUnits(): bigint {
    return this.units;
  }


  toString(): string {
    const integer = this.units / Money.SCALE_FACTOR;
    const decimal = this.units % Money.SCALE_FACTOR;

    const decimalStr = decimal.toString().padStart(Number(Money.SCALE), "0");

    return `${integer}.${decimalStr}`;
  }

  toJSON(): string {
    return this.toString(); // garante serialização determinística
  }

  // ===============================
  // INTERNOS
  // ===============================

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch");
    }
  }
}
