"""Phase 0 onboarding agent.

For each PDF CV in the 01_CV_Dropzone Drive folder:
  1. Download it.
  2. Extract structured candidate data with Gemini.
  3. Append a row to the Skills_DB tab of the CRM Google Sheet.
  4. Move the PDF to 02_Processed_CVs.
"""

import logging

import config
from models import CandidateProfile
from services import google_api
from services.extractor import extract_candidate_profile

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def profile_to_row(profile: CandidateProfile, source_file: str) -> list:
    """Flatten a CandidateProfile into a row matching the Skills_DB columns."""
    return [
        profile.firstName,
        profile.lastName,
        profile.email or "",
        profile.location or "",
        profile.role or "",
        profile.level.value if profile.level else "",
        profile.yearsOfExperience if profile.yearsOfExperience is not None else "",
        ", ".join(profile.pastIndustryExperience),
        ", ".join(profile.skills),
        ", ".join(profile.certifications),
        profile.linkedin or "",
        source_file,
    ]


def resolve_folder_ids(drive_service) -> tuple[str, str]:
    """Resolve dropzone/processed folder IDs, discovering by name if not configured."""
    dropzone_id = config.DROPZONE_FOLDER_ID
    if not dropzone_id:
        logger.info("Discovering folder '%s' by name...", config.DROPZONE_FOLDER_NAME)
        dropzone_id = google_api.find_folder_id_by_name(drive_service, config.DROPZONE_FOLDER_NAME)

    processed_id = config.PROCESSED_FOLDER_ID
    if not processed_id:
        logger.info("Discovering folder '%s' by name...", config.PROCESSED_FOLDER_NAME)
        processed_id = google_api.find_folder_id_by_name(drive_service, config.PROCESSED_FOLDER_NAME)

    return dropzone_id, processed_id


def run() -> None:
    if not config.CRM_SPREADSHEET_ID:
        raise RuntimeError("CRM_SPREADSHEET_ID environment variable is not set.")

    credentials = google_api.get_credentials()
    drive_service = google_api.build_drive_service(credentials)
    sheets_service = google_api.build_sheets_service(credentials)

    dropzone_id, processed_id = resolve_folder_ids(drive_service)
    logger.info("Dropzone folder ID: %s", dropzone_id)
    logger.info("Processed folder ID: %s", processed_id)

    pdfs = google_api.list_pdfs_in_folder(drive_service, dropzone_id)
    if not pdfs:
        logger.info("No PDFs found in the dropzone. Nothing to do.")
        return

    logger.info("Found %d PDF(s) to process.", len(pdfs))

    for pdf in pdfs:
        file_id = pdf["id"]
        file_name = pdf["name"]
        logger.info("Processing '%s' (id=%s)...", file_name, file_id)

        try:
            pdf_bytes = google_api.download_file(drive_service, file_id)
            profile = extract_candidate_profile(pdf_bytes, file_name)

            row = profile_to_row(profile, file_name)
            google_api.append_row_to_sheet(
                sheets_service, config.CRM_SPREADSHEET_ID, config.SKILLS_DB_SHEET_NAME, row
            )
            logger.info("Appended '%s %s' to %s.", profile.firstName, profile.lastName, config.SKILLS_DB_SHEET_NAME)

            google_api.move_file(drive_service, file_id, processed_id, dropzone_id)
            logger.info("Moved '%s' to processed folder.", file_name)

        except Exception:
            logger.exception("Failed to process '%s'. Skipping.", file_name)
            continue

    logger.info("Done.")


if __name__ == "__main__":
    run()
