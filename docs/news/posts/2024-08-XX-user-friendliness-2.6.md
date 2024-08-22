---
blogpost: true
category: XXX
tags: usability
date: 2024-08-XX
---

[TOC]

# Recent improvements in user friendliness in AiiDA v2.6

Dear users,

As we are always working hard to improve your experience with AiiDA, we would like to share with you some of the
new features improving user friendliness implemented since the last major release v2.0.

## Service-less installation

_Get to a running AiiDA installation in seconds_

While `PostgreSQL` (PSQL) as database backend and `RabbitMQ` (RMQ) as message broker provide high-performance and
high-throughput capabilities, we have found over the years that their setup can pose an initial hurdle for new users.

Therefore, recent changes have now made it possible to run AiiDA entirely without them[^1]. This can be achieved with the new command `verdi presto`, which reduces the installation effort of AiiDA to a mere two
commands:

```shell
pip install aiida-core
verdi presto
```

On running the command, you are greeted with:

```shell
Report: Option `--use-postgres` not enabled: configuring the profile to use SQLite.
Report: RabbitMQ server not found (Failed to connect with following connection parameters: {'protocol': 'amqp', 'username': 'guest', 'password': 'guest', 'host': '127.0.0.1', 'port': 5672, 'virtual_host': ''}): configuring the profile without a broker.
Report: Initialising the storage backend.
Report: Storage initialisation completed.
Success: Created new profile `presto`.
Success: Configured the localhost as a computer.
```

After successfull profile creation, `verdi status` returns:

```shell
 ✔ version:     AiiDA v2.6.2
 ✔ config:      /home/aiidateam/aiida_projects/aiida-blog/.aiida
 ✔ profile:     presto
 ✔ storage:     SqliteDosStorage[/home/aiidateam/aiida_projects/aiida-blog/.aiida/repository/sqlite_dos_d2a4e83ea09141678de8ea4b2250fc69]: open,
 ⏺ broker:      No broker defined for this profile: certain functionality not available.
 ⏺ daemon:      No broker defined for this profile: daemon is not available.
```

As you can see, `verdi presto` creates a profile without RMQ and uses SQLite instead of PSQL (however, the latter can
also be selected with the `--use-postgres` flag).

The use of RMQ is also optional, and if you would like to upgrade down the road, worry not, you can still configure it
after profile creation, using:

```shell
verdi profile configure-rabbitmq
```

Instead, if RMQ was already available on your system, the output of `verdi presto` as shown above will be slightly
different:

```shell
Report: Option `--use-postgres` not enabled: configuring the profile to use SQLite.
Report: RabbitMQ server detected: configuring the profile with a broker.
Report: Initialising the storage backend.
Report: Storage initialisation completed.
Success: Created new profile `presto`.
Success: Configured the localhost as a computer.
```

In addition to `verdi presto`, the new command:

```shell
verdi profile setup
```

can be used to create profiles specifying the database backend. Using SQLite, the command could be:

```shell
verdi profile setup core.sqlite_dos -n --profile aiida_rocks --email aiida_rocks@gmail.com
```

Please note that `verdi setup` and `verdi quicksetup` will still work for now, but deprecation warnings will be issued
as we eventually plan to remove them.

Have fun getting your feet wet!

## Ease the  transition from file-system to database

_Mirror your process data from the internal AiiDA storage to classical file trees_

Another concept that can initially be difficult to grasp is the difference between the typical file-system approach
most of us are familiar with, and the database-driven high-performance data organization used in AiiDA.

While the raw files are of course available, accessing them is not straightforward:

- The local file repository typically depends on the fairly involved
  [`disk-objectstore`](https://github.com/aiidateam/disk-objectstore) implementation, while
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
      <th width="500px"> `tree` on a dumped example `CalcJob` </th>
      <th width="500px"> `tree -d ` on a dumped example `WorkChain`  </th>
    </tr>
  </thead>
  <tbody>
  <tr width="600px">
      <td style="word-break:break-all;">

```shell
dump-PwCalculation-42
├── README
├── inputs
│  ├── _aiidasubmit.sh
│  └── aiida.in
├── outputs
│  ├── _scheduler-stderr.txt
│  ├── _scheduler-stdout.txt
│  ├── aiida.out
│  └── data-file-schema.xml
└── node_inputs
   └── pseudos
      └── Si
         └── Si.pbesol-n-rrkjus_psl.1.0.0.UPF











```

</td>
<td>

```shell
dump-PwBandsWorkChain-42
├── 01-relax-PwRelaxWorkChain
│  ├── 01-iteration_01-PwBaseWorkChain
│  │  ├── 01-create_kpoints_from_distance
│  │  │  └── inputs
│  │  └── 02-iteration_01-PwCalculation
│  │     ├── inputs
│  │     ├── node_inputs
│  │     │  └── pseudos
│  │     │     └── Si
│  │     └── outputs
│  └── 02-iteration_02-PwBaseWorkChain
│     ├── 01-create_kpoints_from_distance
│     │  └── inputs
│     └── 02-iteration_01-PwCalculation
│        ├── inputs
│        ├── node_inputs
│        │  └── pseudos
│        │     └── Si
│        └── outputs
├── 02-seekpath-seekpath_structure_analysis
│  └── inputs
├── 03-scf-PwBaseWorkChain
│  ├── ...
...
```

</td>
</tr>

  </tbody>
</table>

In the dumped directory tree, you can explore all files involved in the execution of an AiiDA workflow with the shell
tools we all know and love, so happy grepping!

## New QueryBuilder Syntax

_More intuitive way to query for your data_

In addition, we have implemented an additional syntax of constructing queries via the `QueryBuilder`. Assume you wanted
to obtain all integers with `pk`s in a range between 1 and 10 (both excluded) from a `Group` called "integers", you'd
have to construct the rather convoluted query as shown in the left column of the following table:

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

Query away!

## Automatic serialization of base data types

_Don't worry about base data types, AiiDA's got your back_

Inheritance of all AiiDA data classes from the `Node` class ensures recording in the database and therefore also the
provenance graph. If you have ever wondered why AiiDA redefines base types such as `int` and `float` as `Int` and
`Float`, that's why!

Previously, passing the Python base data types to an AiiDA `CalcFunction` would raise a `TypeError`, as explicit
conversion to AiiDA ORM types was required by the user/developer. We have relaxed this requirement now, such that for base
types, like `int`, `float`, or `str`, the conversion to AiidA data types is now done automatically. How this simplifies
calling a `my_function` `CalcFunction` that takes varous arguments can be seen in the following code snippets:


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

***

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
    Installation should be fairly simple, e.g. via `sudo apt install rabbitmq-server` on Ubuntu.

[^3]:
    A [dedicated section](https://aiida.readthedocs.io/projects/aiida-core/en/v2.5.0/topics/storage.html) was added to
    the documentation to give a short overview of the available database backends, and when to use which.
