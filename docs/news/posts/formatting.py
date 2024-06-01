QueryBuilder().append(
    Group,
    filters=Group.fields.label == "integers",
    project=[Group.fields.label],
    tag="group",
).append(
    Int,
    with_incoming="group",
    filters=(Int.fields.pk > 1) & (Int.fields.pk < 10),
    project=[Int.fields.pk, Int.fields.value],
)
