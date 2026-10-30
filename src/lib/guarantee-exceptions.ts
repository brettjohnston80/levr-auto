// The data files behind the guarantee exceptions (GX-2). Read at build like held-models.json:
// a change reaches the site on the next deploy. A paid search keeps the state it was given.
import exceptions from "../../data/guarantee-exceptions.json";
import whileInventory from "../../data/while-inventory-lasts.json";
import {
  exceptionMake,
  guaranteeColumnsFor,
  whileInventoryLastsEntry,
  type GuaranteeException,
  type WhileInventoryLasts,
} from "./guarantee-exception-rule";

export const GUARANTEE_EXCEPTIONS = exceptions as GuaranteeException[];
export const WHILE_INVENTORY_LASTS = whileInventory as WhileInventoryLasts[];

export const guaranteeExceptionMake = (make: string | null | undefined) => exceptionMake(GUARANTEE_EXCEPTIONS, make);
export const guaranteeColumns = (make: string | null | undefined) => guaranteeColumnsFor(GUARANTEE_EXCEPTIONS, make);
export const whileInventoryLasts = (make: string, model: string, modelYear: number | null) =>
  whileInventoryLastsEntry(WHILE_INVENTORY_LASTS, make, model, modelYear);
