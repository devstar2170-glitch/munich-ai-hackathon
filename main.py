"""CLI entry point for the RFP Analysis Agent."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.rule import Rule
from rich.table import Table, box
from rich.text import Text

from rfp_agent import RFPAnalysisAgent, RFPAnalysis

load_dotenv()

app = typer.Typer(help="RFP Analysis Agent — extracts structured intelligence from RFP documents")
console = Console()


@app.command()
def analyze(
    file_paths: List[Path] = typer.Argument(..., help="One or more RFP documents (PDF, DOCX, TXT)"),
    output_dir: Optional[Path] = typer.Option(
        None, "--output-dir", "-o",
        help="Directory to save JSON analysis files (one per document)"
    ),
    planning_dir: Optional[Path] = typer.Option(
        None, "--planning-dir", "-p",
        help="Directory to save Planning Agent payload files (one per document)"
    ),
    model: str = typer.Option("gemini-2.5-flash", "--model", "-m", help="Gemini model to use"),
    api_key: Optional[str] = typer.Option(None, "--api-key", envvar="GEMINI_API_KEY"),
):
    """Analyze one or more RFP documents and extract structured intelligence."""
    missing = [f for f in file_paths if not f.exists()]
    if missing:
        for f in missing:
            console.print(f"[red]File not found: {f}[/red]")
        raise typer.Exit(1)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
    if planning_dir:
        planning_dir.mkdir(parents=True, exist_ok=True)

    try:
        agent = RFPAnalysisAgent(api_key=api_key, model=model)
    except ValueError as e:
        console.print(f"[red]Configuration error: {e}[/red]")
        raise typer.Exit(1)

    total = len(file_paths)

    for idx, file_path in enumerate(file_paths, start=1):
        console.print()
        console.print(Rule(
            f"  Document {idx}/{total}: {file_path.name}  ",
            style="dim",
            align="left",
        ))

        with console.status(f"Analyzing {file_path.name}...", spinner="dots"):
            try:
                analysis = agent.analyze_file(str(file_path))
            except Exception as e:
                console.print(f"[red]  Analysis failed: {e}[/red]")
                continue

        _display_analysis(analysis, console)

        stem = file_path.stem

        if output_dir:
            out = output_dir / f"{stem}.json"
            out.write_text(analysis.model_dump_json(indent=2), encoding="utf-8")
            console.print(f"\n  Saved: {out}")

        if planning_dir:
            out = planning_dir / f"{stem}_planning.json"
            payload = agent.to_planning_agent_payload(analysis)
            out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            console.print(f"  Saved: {out}")

    console.print()
    console.print(Rule(style="dim"))

    if not output_dir and not planning_dir:
        console.print(
            "[dim]Tip: use --output-dir results/ to save JSON files for all analyzed documents[/dim]"
        )


def _display_analysis(analysis: RFPAnalysis, console: Console) -> None:
    console.print()

    # Header block
    console.print(f"  [bold]{analysis.rfp_title}[/bold]")
    if analysis.client_name:
        console.print(f"  Client:     {analysis.client_name}")
    if analysis.submission_deadline:
        console.print(f"  Deadline:   {analysis.submission_deadline}")
    if analysis.project_duration:
        console.print(f"  Duration:   {analysis.project_duration}")
    if analysis.estimated_team_size:
        console.print(f"  Team size:  {analysis.estimated_team_size}")

    score = analysis.confidence_score
    score_label = "high" if score >= 0.75 else "medium" if score >= 0.5 else "low"
    console.print(f"  Confidence: {score:.0%}  ({score_label})")

    console.print()
    console.print(f"  [bold]SUMMARY[/bold]")
    console.print(f"  {analysis.rfp_summary}")

    # Requirements table
    console.print()
    console.print(f"  [bold]REQUIREMENTS[/bold]  ({len(analysis.requirements)} found)")
    req_table = Table(
        show_header=True,
        header_style="bold",
        box=box.SIMPLE,
        padding=(0, 2),
        show_edge=False,
    )
    req_table.add_column("ID", width=8)
    req_table.add_column("Category", width=13)
    req_table.add_column("Title", width=38)
    req_table.add_column("Priority", width=9)
    req_table.add_column("Mandatory", width=9)
    for r in analysis.requirements:
        priority_style = {"high": "bold", "medium": "", "low": "dim"}.get(r.priority, "")
        req_table.add_row(
            r.id,
            r.category,
            r.title[:38],
            Text(r.priority, style=priority_style),
            "yes" if r.is_mandatory else "no",
        )
    console.print(req_table)

    # Skills matrix
    console.print(f"  [bold]SKILLS REQUIRED[/bold]  ({len(analysis.skills_required)} skills — forwarded to Planning Agent)")
    skills_table = Table(
        show_header=True,
        header_style="bold",
        box=box.SIMPLE,
        padding=(0, 2),
        show_edge=False,
    )
    skills_table.add_column("Skill", width=30)
    skills_table.add_column("Category", width=14)
    skills_table.add_column("Level", width=9)
    skills_table.add_column("People", width=7)
    skills_table.add_column("Context", width=40)
    for s in analysis.skills_required:
        skills_table.add_row(
            s.skill[:30],
            s.category,
            s.proficiency_level,
            str(s.quantity_needed),
            s.context[:40],
        )
    console.print(skills_table)

    # Deadlines
    if analysis.deadlines:
        console.print(f"  [bold]DEADLINES[/bold]")
        for d in analysis.deadlines:
            date_str = f"{d.date}  " if d.date else ""
            criticality = f"[{d.criticality}]" if d.criticality != "low" else ""
            console.print(f"    {date_str}{d.milestone}  {criticality}")
        console.print()

    # Dependencies
    if analysis.dependencies:
        console.print(f"  [bold]DEPENDENCIES[/bold]")
        for dep in analysis.dependencies:
            tag = f"[{dep.type}]"
            console.print(f"    {tag:<12} {dep.name}: {dep.description}")
        console.print()

    # Risks
    if analysis.risks:
        console.print(f"  [bold]RISKS[/bold]")
        for r in analysis.risks:
            impact_style = {"high": "bold", "medium": "", "low": "dim"}.get(r.impact, "")
            label = Text(f"[{r.impact.upper()}]", style=impact_style)
            console.print(Text("    ") + label + Text(f"  {r.title}"))
            console.print(f"          {r.description}")
        console.print()

    # Compliance norms
    if analysis.compliance_norms:
        console.print(f"  [bold]COMPLIANCE NORMS[/bold]")
        norms_table = Table(
            show_header=True,
            header_style="bold",
            box=box.SIMPLE,
            padding=(0, 2),
            show_edge=False,
        )
        norms_table.add_column("Standard", width=18)
        norms_table.add_column("Mandatory", width=10)
        norms_table.add_column("Cert. required", width=15)
        norms_table.add_column("Description", width=45)
        for c in analysis.compliance_norms:
            norms_table.add_row(
                c.name,
                "yes" if c.mandatory else "no",
                "yes" if c.certification_required else "no",
                c.description[:45],
            )
        console.print(norms_table)

    # Pitfalls
    if analysis.pitfalls:
        console.print(f"  [bold]PITFALLS[/bold]")
        for p in analysis.pitfalls:
            console.print(f"    - {p}")
        console.print()


if __name__ == "__main__":
    app()
