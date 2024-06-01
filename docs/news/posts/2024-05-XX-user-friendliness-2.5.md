---
blogpost: true
category: XXX
tags: usability
date: 2024-05-XX
---

[TOC]

# Recent improvements in user friendliness in AiiDA

Dear users,

As we are always working hard to improve your experience with AiiDA, we would like to share with you some of the
changes to improve user friendliness that have been implemented since the major release 2.0.

## Service-less installation

While `PostgreSQL` as database backend and `RabbitMQ` as message broker were initially chosen with high-performance and
high-throughput capabilities in mind, we have found over the years that their setup can pose a significant initial
hurdle for new users - We estimate that about half of the issues reported on [Discourse](aiida.discourse.group/) are
related to the setup of these services.

Therefore, recent changes to the code base have now made it possible to run AiiDA entirely without them [^1]. For one, this is
achieved by providing `SQLite` as an alternative database backend [^2]. For this, the new command:

```shell
verdi profile setup
```

can be used to create profiles with this database backend, for example via:

```shell
verdi profile setup core.sqlite_dos -n --profile aiida_rocks --email aiida_rocks@mail.com
```

We also have made the use of `RabbitMQ` optional and now provide the turn-key solution `verdi presto`, with which you
can set up a functioning, fully service-less AiiDA profile with just two commands:

```shell=
pip install aiida-core
verdi presto
```

Start getting your feet wet!

## Softer transition from file-system to database

Another often reported hurdle is the conceptual difference between the typical file-system approach most of us are
familiar with, and the database-driven data organization implemented in AiiDA.

While the raw files are of course available, accessing them is not straightforward:

- The local file repository typically depends on the fairly complex [`disk-objectstore`](https://github.com/aiidateam/disk-objectstore), while
- On the remote computer, files are stored in a hierarchical structure with folder names based on the universally unique
  identifiers (UUIDs) of the corresponding AiiDA `Nodes`.

The second point here nicely illustrates the issue - the data storage logic was
constructed to be _machine-readable_ rather than _human-readable_ - again with high performance in mind. Unfortunately,
this locks a new user into the database-driven approach taken by AiiDA, effectively forcing them to use the `verdi`
CLI interface or the AiiDA Python API to access their data.

To ease the transition, we have added a functionality to dump `processes` and even the whole AiiDA archive to disk in
a sensible directory structure:

```shell
verdi process dump <pk>
verdi archive dump (to be implemented)
```

The results of dumping a `pw.x` calculation, as well as a more complex band structure workflow using Quantum ESPRESSO are showcased in the following table:

<!-- prettier-ignore -->
<!-- Taken from: https://gist.github.com/panoply/176101828af8393adc821e49578ac588 -->
<table style="table-layout: fixed; width: 100%">
  <thead>
    <tr>
      <th width="500px"> `tree` on a dumped `CalcJob` </th>
      <th width="500px"> `tree -d ` on a dumped `WorkChain`  </th>
    </tr>
  </thead>
  <tbody>
  <tr width="600px">
      <td style="word-break:break-all;">

```shell
dump-PwCalculation-42
├── README
├── raw_inputs
│  ├── _aiidasubmit.sh
│  └── aiida.in
├── raw_outputs
│  ├── _scheduler-stderr.txt
│  ├── _scheduler-stdout.txt
│  ├── aiida.out
│  └── data-file-schema.xml
└── extra_inputs
   └── pseudos
      └── Si
         └── Si.pbesol-n-rrkjus_psl.1.0.0.UPF





```

</td>
<td>

```shell
dump-PwBandsWorkChain-42
├── 01-relax-PwRelaxWorkChain
│  ├── 01-PwBaseWorkChain
│  │  └── 01-PwCalculation
│  │     ├── raw_inputs
│  │     ├── raw_outputs
│  │     └── extra_inputs
│  │        └── pseudos
│  │           └── Si
│  └── 02-PwBaseWorkChain
│     └── 01-PwCalculation
│        ├── raw_inputs
│        ├── raw_outputs
│        └── extra_inputs
│           └── pseudos
│              └── Si
├── 02-scf-PwBaseWorkChain
│  ├── ...
...
```

</td>
</tr>

  </tbody>
</table>

In the dumped directory tree, you can explore all files involved in the execution of an AiiDA workflow with the shell
tools we all know and love.

Happy grepping!

## New QueryBuilder Syntax

In addition, we have improved the Syntax of the `QueryBuilder`. Assume you wanted to obtain all integers with `pk`s in a range
between 1 and 10 (both excluded) from a `Group` called "integers", you'd have to construct the rather convoluted query
as shown in the left column of the following table:

<!-- prettier-ignore -->
<!-- Taken from: https://gist.github.com/panoply/176101828af8393adc821e49578ac588 -->
<table style="table-layout: fixed; width: 100%">
  <thead>
    <tr>
      <th width="500px"> Old `QueryBuilder` syntax </th>
      <th width="500px"> New `QueryBuilder` syntax </th>
    </tr>
  </thead>
  <tbody>
  <tr width="600px">
      <td style="word-break:break-all;">

```python
QueryBuilder().append(
    Group,
    filters={
        "label": "integers",
    },
    project=["label"],
    tag="group",
).append(
    Int,
    with_incoming="group",
    filters={
        "and": [
            {"pk": {">": 1}},
            {"pk": {"<": 10}},
        ]
    },
    project=["pk", "attributes.value"],
)
```

</td>
<td>

```python
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







```

</td>
</tr>

  </tbody>
</table>

With the new syntax, `Node` attributes are directly accessible via the
`.fields` entry point, and logic can be applied to them directly. As such, the filter on the values of the `pk`s reduces
from:
```python
filters={
    "and": [
        {"pk": {">": 1}},
        {"pk": {"<": 10}},
    ]
},
```

to the more concise:

```python
filters=(Int.fields.pk > 1) & (Int.fields.pk < 10),
```

in which the `"and"` condition can be directly accessed via `&` and applied on the relevant attributes.

Happy querying!

## Automatic serialization of base data types

Inheritance of all AiiDA data classes from the `Node` class ensures recording in the provenance graph and the
database. If you have ever wondered why AiiDA redefines base types such as `int` and `float` as `Int` and `Float`, that's
why! Previously, passing the Python base data types to a function decorated with the `calcfunction` decorator would
raise a `TypeError`

<!-- prettier-ignore -->
<!-- Taken from: https://gist.github.com/panoply/176101828af8393adc821e49578ac588 -->
<table style="table-layout: fixed; width: 100%">
  <thead>
    <tr>
      <th width="500px"> Explicit conversion to AiiDA data types </th>
      <th width="500px"> Automatic conversion to AiiDA data types </th>
    </tr>
  </thead>
  <tbody>
  <tr width="600px">
      <td style="word-break:break-all;">

```python
from aiida.engine import calcfunction
from aiida.orm import Bool, Float, Int, Str

@calcfunction
def my_function(switch, threshold, count, label):
    ...

my_function(Bool(True), Float(0.25), Int(10), Str('some-label'))
```

</td>
<td>

```python
from aiida.engine import calcfunction


@calcfunction
def my_function(switch, threshold, count, label):
    ...

my_function(True, 0.25, 10, 'some-label')
```

</td>
</tr>

  </tbody>
</table>

## Outlook

-

---

## Relevant PRs

For the more tech-savy among us, here are the relevant PRs of the changes outlined in this blog post:

- Add the `SqliteDosStorage` storage backend [[702f88788]](https://github.com/aiidateam/aiida-core/commit/702f8878829b8e2a65d81623cc2238eb40791bc6)
- CLI: Add the command `verdi profile setup` [[351021164]](https://github.com/aiidateam/aiida-core/commit/351021164d00aa3a2a78b5b6e43e8a87a8553151)

## Footnotes

[^1]:
    It should be kept in mind, however, that these two changes come at the cost of lower performance, and should not
    be used in production. Rather, they are mainly intended for new users to get a running AiiDA instance quickly to be able
    to play around with the tool.

[^2]:
    A [dedicated section](https://aiida.readthedocs.io/projects/aiida-core/en/v2.5.0/topics/storage.html) was added to
    the documentation to give a short overview of the available database backends, and when to use which.
