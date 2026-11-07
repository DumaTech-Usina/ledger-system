// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Select } from "./Select";

const names = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabi", "Halisson"];
const options = names.map((n) => ({ value: n, label: n }));

afterEach(cleanup);

describe("Select", () => {
  it("draws the list on the page body, outside any card that would cover it", () => {
    const { container } = render(<Select label="Parte" value="" onChange={() => {}} options={options.slice(0, 3)} />);

    fireEvent.click(screen.getByRole("button"));

    const option = screen.getByRole("option", { name: "Ana" });
    expect(container.contains(option)).toBe(false);
    expect(document.body.contains(option)).toBe(true);
  });

  it("commits the choice and closes", () => {
    const onChange = vi.fn();
    render(<Select value="" onChange={onChange} options={options.slice(0, 3)} />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("option", { name: "Bruno" }));

    expect(onChange).toHaveBeenCalledWith("Bruno");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("closes on a click outside, and not on one inside the list", () => {
    render(<Select value="" onChange={() => {}} options={options} searchPlaceholder="Buscar" />);
    fireEvent.click(screen.getByRole("button"));

    fireEvent.mouseDown(screen.getByPlaceholderText("Buscar"));
    expect(screen.queryAllByRole("option")).toHaveLength(names.length);

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("a long list can be filtered, ignoring accents and case", () => {
    render(<Select value="" onChange={() => {}} options={options} searchPlaceholder="Buscar" />);
    fireEvent.click(screen.getByRole("button"));

    fireEvent.change(screen.getByPlaceholderText("Buscar"), { target: { value: "fabio" } });

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Fábio"]);
  });

  it("a short list has no filter box", () => {
    render(<Select value="" onChange={() => {}} options={options.slice(0, 3)} searchPlaceholder="Buscar" />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByPlaceholderText("Buscar")).toBeNull();
  });
});
