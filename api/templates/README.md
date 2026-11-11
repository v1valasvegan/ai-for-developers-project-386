# Rust Axum model template

`rust-axum/models.mustache` is copied from OpenAPI Generator **7.26.0**
(`rust-axum/models.mustache` inside the checksum-verified generator JAR).
Upstream source: <https://github.com/OpenAPITools/openapi-generator/tree/v7.26.0/modules/openapi-generator/src/main/resources/rust-axum>.

The only customization wraps the two ordinary model-property `check_xss_string`
annotations in `{{^vendorExtensions.x-plain-text}}` conditions. The contract marks
only meeting-type `title` and `description` as `x-plain-text`: HTML-looking text is
literal text, not rich text. React renders these fields through escaped text nodes,
never HTML. Rejecting HTML-looking strings would narrow the agreed input contract.

All generated type, length, pattern, range, nested and other validation remains;
`disableValidator=false` remains in the generation command. Creation additionally
validates normalized/trimmed values at the handler boundary. The extension is not
a general-purpose validator bypass and must not be applied to other fields without
an explicit contract decision.

When upgrading the generator, compare this file against the new upstream template
and reapply only these conditions. Real HTTP and browser type-creation tests cover
literal markup acceptance and inert rendering alongside normal validation.
