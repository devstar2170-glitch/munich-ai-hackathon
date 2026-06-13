"""CLI entry point for the RFP Analysis Agent."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from rfp_agent import RFPAnalysisAgent, RFPAnalysis

load_dotenv()

app = typer.Typer(help="RFP Analysis Agent — extracts structured intelligence from RFP documents")
console = Console()


@app.command()
def analyze(
    file_path: str = typer.Argument(..., help="Path to the RFP document (PDF, DOCX, TXT, MD)"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Save full JSON analysis to this file"),
    planning_payload: Optional[str] = typer.Option(
        None, "--planning-output", "-p", help="Save Planning Agent payload to this file"
    ),
    model: str = typer.Option("gemini-2.0-flash", "--model", "-m", help="Gemini model to use"),
    api_key: Optional[str] = typer.Option(None, "--api-key", envvar="GEMINI_API_KEY"),
):
    """Analyze an RFP document and extract structured intelligence."""
    console.print(Panel.fit(
        f"[bold blue]RFP Analysis Agent[/bold blue]\n[dim]Model: {model}[/dim]",
        border_style="blue",
    ))

    if not Path(file_path).exists():
        console.print(f"[red]Error: File not found: {file_path}[/red]")
        raise typer.Exit(1)

    try:
        agent = RFPAnalysisAgent(api_key=api_key, model=model)
    except ValueError as e:
        console.print(f"[red]Configuration error: {e}[/red]")
        raise typer.Exit(1)

    with console.status("[bold green]Analyzing RFP document...", spinner="dots"):
        try:
            analysis = agent.analyze_file(file_path)
        except Exception as e:
            console.print(f"[red]Analysis failed: {e}[/red]")
            raise typer.Exit(1)

    _display_analysis(analysis, console)

    # Save full JSON
    if output:
        Path(output).write_text(analysis.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"\n[green]Full analysis saved → {output}[/green]")

    # Save Planning Agent payload
    if planning_payload:
        payload = agent.to_planning_agent_payload(analysis)
        Path(planning_payload).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        console.print(f"[green]Planning Agent payload saved → {planning_payload}[/green]")

    # Always print JSON to stdout if no output file specified (useful for piping to other agents)
    if not output and not planning_payload:
        console.print("\n[dim]Tip: use --output result.json to save the full analysis[/dim]")


def _display_analysis(analysis: RFPAnalysis, console: Console) -> None:
    # Header
    console.print(f"\n[bold]{analysis.rfp_title}[/bold]")
    if analysis.client_name:
        console.print(f"Client: [cyan]{analysis.client_name}[/cyan]")
    if analysis.submission_deadline:
        console.print(f"Submission Deadline: [yellow]{analysis.submission_deadline}[/yellow]")
    console.print(f"Confidence: [{'green' if analysis.confidence_score >= 0.7 else 'yellow'}]{analysis.confidence_score:.0%}[/]")

    console.print(f"\n[bold]Summary[/bold]\n{analysis.rfp_summary}")

    # Requirements table
    console.print(f"\n[bold]Requirements[/bold] ({len(analysis.requirements)} found)")
    req_table = Table(show_header=True, header_style="bold magenta", box=None, padding=(0, 1))
    req_table.add_column("ID", style="dim", width=8)
    req_table.add_column("Category", width=12)
    req_table.add_column("Title", width=35)
    req_table.add_column("Priority", width=8)
    req_table.add_column("Mandatory", width=9)
    for r in analysis.requirements:
        priority_style = {"high": "red", "medium": "yellow", "low": "green"}.get(r.priority, "white")
        req_table.add_row(
            r.id,
            r.category,
            r.title[:35],
            Text(r.priority, style=priority_style),
            "Yes" if r.is_mandatory else "No",
        )
    console.print(req_table)

    # Skills matrix
    console.print(f"\n[bold]Skills Required[/bold] ({len(analysis.skills_required)} skills — sent to Planning Agent)")
    skills_table = Table(show_header=True, header_style="bold cyan", box=None, padding=(0, 1))
    skills_table.add_column("Skill", width=28)
    skills_table.add_column("Category", width=14)
    skills_table.add_column("Level", width=8)
    skills_table.add_column("# People", width=8)
    skills_table.add_column("Context", width=40)
    for s in analysis.skills_required:
        skills_table.add_row(s.skill, s.category, s.proficiency_level, str(s.quantity_needed), s.context[:40])
    console.print(skills_table)

    # Deadlines
    if analysis.deadlines:
        console.print(f"\n[bold]Deadlines & Milestones[/bold]")
        for d in analysis.deadlines:
            date_str = f"[yellow]{d.date}[/yellow] — " if d.date else ""
            console.print(f"  • {date_str}{d.milestone}: {d.description}")

    # Dependencies
    if analysis.dependencies:
        console.print(f"\n[bold]Dependencies[/bold]")
        for dep in analysis.dependencies:
            tag = f"[{'blue' if dep.type == 'internal' else 'magenta'}]{dep.type.upper()}[/]"
            console.print(f"  • {tag} [{dep.category}] {dep.name}: {dep.description}")

    # Risks
    if analysis.risks:
        console.print(f"\n[bold]Risks & Pitfalls[/bold]")
        for r in analysis.risks:
            impact_style = {"high": "red", "medium": "yellow", "low": "green"}.get(r.impact, "white")
            console.print(f"  • [{impact_style}]{r.impact.upper()}[/] [{r.category}] {r.title}")
            console.print(f"    {r.description}")

    # Compliance
    if analysis.compliance_norms:
        console.print(f"\n[bold]Compliance Norms[/bold]")
        for c in analysis.compliance_norms:
            mandatory = "[red]MANDATORY[/red]" if c.mandatory else "[dim]optional[/dim]"
            cert = " + cert required" if c.certification_required else ""
            console.print(f"  • {mandatory}{cert} — {c.name}: {c.description}")

    # Pitfalls
    if analysis.pitfalls:
        console.print(f"\n[bold][red]Pitfalls to Watch[/red][/bold]")
        for p in analysis.pitfalls:
            console.print(f"  ⚠ {p}")


if __name__ == "__main__":
    app()
