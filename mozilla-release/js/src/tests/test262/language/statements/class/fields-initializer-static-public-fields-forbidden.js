// |reftest| skip error:SyntaxError -- class-fields-public is not supported
// This file was procedurally generated from the following sources:
// - src/class-fields/static-public-fields-forbidden.case
// - src/class-fields/propname-error-static/cls-decl-static-field-initializer.template
/*---
description: static public class fields forbidden (early error -- static ClassElementName Initializer)
features: [class, class-fields-public]
flags: [generated]
negative:
  phase: parse
  type: SyntaxError
---*/


throw "Test262: This statement should not be evaluated.";

class C {
  static field = 0;
}
