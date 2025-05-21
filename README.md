# DFAM Web Synth

This project is a simple web-based recreation of the Moog DFAM (Drummer From Another Mother) synthesizer. The interface and controls mimic the original hardware so you can experiment with sound synthesis directly in your browser.

## Enabling GitHub Pages

1. Open the repository on GitHub and go to **Settings**.
2. Select **Pages** from the sidebar.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Save the configuration. GitHub Pages will be enabled at a URL in the form `https://<username>.github.io/<repository>`.

## Deployment Workflow

A workflow file located at `.github/workflows/deploy.yml` automatically deploys the site whenever you push to the `main` branch. The workflow:

1. Checks out the repository.
2. Sets up GitHub Pages and uploads the site files as an artifact.
3. Deploys the artifact to the `gh-pages` environment using the `actions/deploy-pages` action.

After the workflow completes, your updated site will be live on GitHub Pages.
