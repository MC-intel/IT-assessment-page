
(function () {

    const calcBtn = document.querySelector('.calculate-btn');
    const savePdfBtn = document.querySelector('.save-pdf-btn');
    const requiredFields = [
      document.getElementById('firstName'),
      document.getElementById('lastName'),
      document.getElementById('email'),
      document.getElementById('clubname')
    ];

    const ASSESSMENT_QUESTIONS = [
      'Do you process credit cards anywhere in your club (pro shop, restaurant, beverage carts, etc.)?',
      'Are you PCI DSS compliant across all payment locations?',
      'Are your data backups tested monthly, encrypted, and stored both onsite and offsite with at least one air-gapped copy?',
      'Do you have a tested plan for getting back online quickly if ransomware locks all your systems?',
      'Is your network properly segmented with firewalls separating member systems, staff systems, and guest WiFi?',
      'Are all your servers, workstations, and network equipment under warranty with a documented hardware refresh cycle?',
      'Is access removed immediately when employees leave?',
      'Do you audit user access quarterly and remove unnecessary permissions?',
      'Do you have documented policies for member data collection, storage, and privacy rights?',
      'Do you have 24/7 security monitoring with immediate threat response?',
      'Do all staff receive annual cybersecurity training with simulated phishing tests?',
      'Do you have redundant internet connections that automatically switch during outages?',
      'Do you have a disaster response team with clear roles and communication protocols?'
    ];

    const BACKEND_PDF_UPLOAD_URL = 'https://keyring-fv5f.onrender.com/api/upload-pdf';
    const BACKEND_HUBSPOT_SUBMIT_URL = 'https://keyring-fv5f.onrender.com/api/hubspot/pdf-submit';
    const DEFAULT_PDF_PAGE_WIDTH = 612;
    const DEFAULT_PDF_PAGE_HEIGHT = 792;
    const DEFAULT_TEMPLATE_URL = 'https://keyring-fv5f.onrender.com/api/pdf-template';
    const RESULTS_PDF_FILE_NAME = 'Golf-Club-Security-Assessment-Results.pdf';

    let templatePdfBytesCache = null;
    let latestPdfBytesCache = null;
    let latestPdfSignature = '';
    let templatePdfLoadFailed = false;

    const decodeHTMLEntities = (() => {
      const textarea = document.createElement('textarea');
      return text => {
        if (typeof text !== 'string') {
          return '';
        }

        textarea.innerHTML = text;
        return textarea.value;
      };
    })();

    const decodeBase64ToUint8Array = base64 => {
      if (typeof base64 !== 'string' || base64.trim() === '') {
        throw new Error('PDF template response did not include base64 data.');
      }

      const sanitized = base64.replace(/\s+/g, '');
      const atobFn = typeof atob === 'function'
        ? atob
        : (typeof window !== 'undefined' && typeof window.atob === 'function' ? window.atob : null);

      if (!atobFn) {
        throw new Error('Base64 decoding is not supported in this environment.');
      }

      const binaryString = atobFn(sanitized);
      const length = binaryString.length;
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    };

    const getConfiguredTemplateSources = () => {
      const sources = [];

      const globalConfig = (typeof window !== 'undefined' && (window.PearlAssessmentConfig || window.PearlAssessment)) || {};
      const configUrls = [];

      if (globalConfig) {
        if (Array.isArray(globalConfig.pdfTemplateUrls)) {
          configUrls.push(...globalConfig.pdfTemplateUrls);
        }
        if (typeof globalConfig.pdfTemplateUrl === 'string') {
          configUrls.push(globalConfig.pdfTemplateUrl);
        }
        if (globalConfig.config && typeof globalConfig.config.pdfTemplateUrl === 'string') {
          configUrls.push(globalConfig.config.pdfTemplateUrl);
        }
        if (globalConfig.config && Array.isArray(globalConfig.config.pdfTemplateUrls)) {
          configUrls.push(...globalConfig.config.pdfTemplateUrls);
        }
      }

      const metaElement = typeof document !== 'undefined'
        ? document.querySelector('meta[name="pdf-template-url"]')
        : null;
      if (metaElement && metaElement.content) {
        configUrls.push(metaElement.content);
      }

      const scriptElement = typeof document !== 'undefined'
        ? document.querySelector('script[data-pdf-template-url]')
        : null;
      if (scriptElement && scriptElement.dataset.pdfTemplateUrl) {
        configUrls.push(scriptElement.dataset.pdfTemplateUrl);
      }

      sources.push(...configUrls);

      sources.push(DEFAULT_TEMPLATE_URL);

      const seen = new Set();
      return sources.filter(url => {
        if (typeof url !== 'string' || url.trim() === '') {
          return false;
        }
        if (seen.has(url)) {
          return false;
        }
        seen.add(url);
        return true;
      });
    };

    const fetchTemplateBytes = async source => {
      if (typeof source !== 'string' || source.trim() === '') {
        throw new Error('PDF template source is invalid.');
      }

      const requestInit = {
        headers: {
          Accept: 'application/pdf,application/json;q=0.9,*/*;q=0.8'
        }
      };

      try {
        const isRelative = /^\//.test(source);
        if (!isRelative) {
          requestInit.mode = 'cors';
        }

        const response = await fetch(source, requestInit);
        if (!response.ok) {
          throw new Error(`Failed to fetch template from ${source} (status ${response.status}).`);
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          const data = await response.json();
          const base64 = data.pdfBase64 || data.base64 || data.data || data.body;
          return decodeBase64ToUint8Array(base64);
        }

        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      } catch (error) {
        const message = error && error.message ? error.message : 'Unknown error';
        throw new Error(`Unable to fetch PDF template from ${source}: ${message}`);
      }
    };

    const getTemplatePdfBytes = async () => {
      if (templatePdfBytesCache && templatePdfBytesCache.length) {
        return templatePdfBytesCache;
      }

      if (templatePdfLoadFailed) {
        return null;
      }

      const sources = getConfiguredTemplateSources();

      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        try {
          const bytes = await fetchTemplateBytes(source);
          if (!bytes || !bytes.length) {
            continue;
          }

          templatePdfBytesCache = bytes;
          return templatePdfBytesCache;
        } catch (error) {
          console.warn('Unable to load PDF template from source', source, error);
        }
      }

      templatePdfLoadFailed = true;
      return null;
    };

    const captureParticipant = () => {
      const firstNameInput = document.getElementById('firstName');
      const lastNameInput = document.getElementById('lastName');
      const emailInput = document.getElementById('email');
      const clubNameInput = document.getElementById('clubname');

      return {
        firstName: decodeHTMLEntities(((firstNameInput && firstNameInput.value) || '').trim()),
        lastName: decodeHTMLEntities(((lastNameInput && lastNameInput.value) || '').trim()),
        email: decodeHTMLEntities(((emailInput && emailInput.value) || '').trim()),
        name: decodeHTMLEntities(((clubNameInput && clubNameInput.value) || '').trim())
      };
    };

    const checkFormCompletion = () => {
      const allFilled = requiredFields.every(input => input && input.value.trim() !== '');
      if (calcBtn) {
        calcBtn.disabled = !allFilled;
      }
    };

    requiredFields.forEach(input => {
      if (input) {
        input.addEventListener('input', checkFormCompletion);
      }
    });

    const preparePdfPayload = async (participant, riskLevelText) => {
      const snapshot = getAssessmentSnapshot(participant, riskLevelText);
      const { pdfBytes, signature } = await generateAssessmentPdfBytes(snapshot);

      return {
        pdfBytes,
        signature,
        fileName: RESULTS_PDF_FILE_NAME
      };
    };

    const getAssessmentSnapshot = (participantOverride, riskLevelOverride) => {
      const participant = participantOverride
        ? {
            firstName: decodeHTMLEntities((participantOverride.firstName || '').trim()),
            lastName: decodeHTMLEntities((participantOverride.lastName || '').trim()),
            email: decodeHTMLEntities((participantOverride.email || '').trim()),
            name: decodeHTMLEntities((participantOverride.name || '').trim())
          }
        : captureParticipant();
      const riskLevelEl = document.getElementById('riskLevel');
      const riskLevelText = decodeHTMLEntities(
        (riskLevelOverride || (riskLevelEl ? riskLevelEl.innerText.trim() : ''))
      );

      if (!riskLevelText) {
        throw new Error('Risk level not yet calculated.');
      }

      const riskClass = riskLevelEl ? riskLevelEl.className.replace('risk-level', '').trim() : '';

      const answers = [];
      let yesCount = 0;
      let noCount = 0;
      let unsureCount = 0;
      let naCount = 0;

      ASSESSMENT_QUESTIONS.forEach((question, index) => {
        const selected = document.querySelector(`input[name="q${index + 1}"]:checked`);
        if (selected) {
          answers.push(selected.value);
          if (selected.value === 'yes') {
            yesCount += 1;
          } else if (selected.value === 'no') {
            noCount += 1;
          } else if (selected.value === 'unsure') {
            unsureCount += 1;
          } else if (selected.value === 'na') {
            naCount += 1;
          }
        } else {
          answers.push('Not Answered');
        }
      });

      const detailsElement = document.getElementById('riskDetails');
      const recommendationsElement = document.getElementById('recommendations');

      return {
        participant,
        riskLevelText,
        riskClass,
        answers,
        yesCount,
        noCount,
        unsureCount,
        naCount,
        detailsText: decodeHTMLEntities(detailsElement ? detailsElement.innerText : ''),
        recsText: decodeHTMLEntities(recommendationsElement ? recommendationsElement.innerText : ''),
        today: new Date().toLocaleDateString()
      };
    };

    const createSnapshotSignature = snapshot => JSON.stringify({
      participant: snapshot.participant,
      riskLevelText: snapshot.riskLevelText,
      riskClass: snapshot.riskClass,
      answers: snapshot.answers,
      counts: [snapshot.yesCount, snapshot.noCount, snapshot.unsureCount, snapshot.naCount],
      details: snapshot.detailsText,
      recs: snapshot.recsText,
      today: snapshot.today
    });

    const generateAssessmentPdfBytes = async snapshot => {
      const signature = createSnapshotSignature(snapshot);
      if (latestPdfBytesCache && signature === latestPdfSignature) {
        return { pdfBytes: latestPdfBytesCache, signature };
      }

      const { PDFDocument, rgb, StandardFonts } = window.PDFLib || {};
      if (!PDFDocument || !rgb || !StandardFonts) {
        throw new Error('PDFLib failed to load.');
      }

      const pdfDoc = await PDFDocument.create();

      let templateBackground = null;
      let pageWidth = DEFAULT_PDF_PAGE_WIDTH;
      let pageHeight = DEFAULT_PDF_PAGE_HEIGHT;

      if (!templatePdfLoadFailed) {
        try {
          const templateBytes = await getTemplatePdfBytes();
          if (templateBytes && templateBytes.length) {
            const embeddedPages = await pdfDoc.embedPdf(templateBytes);
            if (embeddedPages && embeddedPages.length > 0) {
              [templateBackground] = embeddedPages;
              const size = templateBackground && typeof templateBackground.size === 'function'
                ? templateBackground.size()
                : null;
              pageWidth = typeof templateBackground.width === 'number'
                ? templateBackground.width
                : (size && typeof size.width === 'number' ? size.width : pageWidth);
              pageHeight = typeof templateBackground.height === 'number'
                ? templateBackground.height
                : (size && typeof size.height === 'number' ? size.height : pageHeight);
            }
          }
        } catch (templateError) {
          templateBackground = null;
          templatePdfLoadFailed = true;
          console.warn('Assessment template PDF unavailable, generating results without background.', templateError);
        }
      }

      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const topMarginFirstPage = 140;
      const topMargin = 70;
      const bottomMargin = 50;
      const contentWidth = pageWidth - 120;

      const addPageWithTemplate = () => {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        if (templateBackground) {
          page.drawPage(templateBackground, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });
        }
        return page;
      };

      let currentPage = addPageWithTemplate();
      let yOffset = topMarginFirstPage;

      const riskColors = {
        'risk-low': rgb(0, 128 / 255, 0),
        'risk-medium': rgb(204 / 255, 140 / 255, 0),
        'risk-high': rgb(204 / 255, 51 / 255, 51 / 255),
        'risk-critical': rgb(153 / 255, 0, 0)
      };

      const answerColors = {
        yes: rgb(0, 128 / 255, 0),
        no: rgb(1, 0, 0),
        unsure: rgb(128 / 255, 128 / 255, 128 / 255),
        na: rgb(23 / 255, 162 / 255, 184 / 255)
      };

      const ensureSpace = (lineHeight = 18) => {
        if (yOffset + lineHeight > pageHeight - bottomMargin) {
          currentPage = addPageWithTemplate();
          yOffset = topMargin;
        }
      };

      const drawLine = ({ text, x = 60, font = regularFont, size = 12, color = rgb(0, 0, 0), lineHeight = 18 }) => {
        ensureSpace(lineHeight);
        currentPage.drawText(text, {
          x,
          y: pageHeight - yOffset,
          size,
          font,
          color
        });
        yOffset += lineHeight;
      };

      const drawCentered = ({ text, font = boldFont, size = 16, color = rgb(0, 0, 0), lineHeight = 24 }) => {
        ensureSpace(lineHeight);
        const textWidth = font.widthOfTextAtSize(text, size);
        const x = (pageWidth - textWidth) / 2;
        currentPage.drawText(text, {
          x,
          y: pageHeight - yOffset,
          size,
          font,
          color
        });
        yOffset += lineHeight;
      };

      const wrapText = (text, maxWidth, font, size) => {
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const width = font.widthOfTextAtSize(testLine, size);
          if (width <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
            }
            currentLine = word;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      };

      const drawParagraph = (text, { x = 60, font = regularFont, size = 12, lineHeight = 18, color = rgb(0, 0, 0), maxWidth = contentWidth } = {}) => {
        const paragraphs = text
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        paragraphs.forEach((paragraph, index) => {
          const lines = wrapText(paragraph, maxWidth, font, size);
          lines.forEach(line => {
            drawLine({ text: line, x, font, size, color, lineHeight });
          });
          if (index < paragraphs.length - 1) {
            yOffset += lineHeight;
          }
        });
      };

      drawCentered({ text: 'Golf Club Cybersecurity Initial Assessment Results', size: 18 });
      drawCentered({ text: "Pearl Solutions Group - Your Club's Digital Caddie", font: regularFont, size: 12, lineHeight: 18 });
      drawCentered({ text: `Assessment Date: ${snapshot.today}`, font: regularFont, size: 12, lineHeight: 18 });

      yOffset += 10;
      drawLine({ text: `Prepared For: ${snapshot.participant.firstName} ${snapshot.participant.lastName}` });
      drawLine({ text: `Email: ${snapshot.participant.email}` });
      drawLine({ text: `Club / Organization: ${snapshot.participant.name}` });

      yOffset += 10;
      drawLine({
        text: `Risk Level: ${snapshot.riskLevelText}`,
        font: boldFont,
        size: 16,
        color: riskColors[snapshot.riskClass] || rgb(0, 0, 0),
        lineHeight: 24
      });

      yOffset += 10;
      drawLine({ text: 'Initial Assessment Summary:', font: boldFont, size: 14, lineHeight: 22 });
      drawLine({ text: `Yes Answers: ${snapshot.yesCount}/${ASSESSMENT_QUESTIONS.length}`, x: 80 });
      drawLine({ text: `No Answers: ${snapshot.noCount}/${ASSESSMENT_QUESTIONS.length}`, x: 80 });
      drawLine({ text: `Unsure Answers: ${snapshot.unsureCount}/${ASSESSMENT_QUESTIONS.length}`, x: 80 });
      drawLine({ text: `Not Applicable: ${snapshot.naCount}/${ASSESSMENT_QUESTIONS.length}`, x: 80 });

      currentPage = addPageWithTemplate();
      yOffset = topMargin;

      drawCentered({ text: 'Assessment Questions & Responses', size: 16 });
      yOffset += 10;

      ASSESSMENT_QUESTIONS.forEach((question, index) => {
        const decodedQuestion = decodeHTMLEntities(question);
        const questionLines = wrapText(`${index + 1}. ${decodedQuestion}`, contentWidth, regularFont, 11);
        questionLines.forEach(line => {
          drawLine({ text: line, x: 60, font: regularFont, size: 11, lineHeight: 16 });
        });

        const answer = snapshot.answers[index];
        const color = answerColors[answer] || rgb(128 / 255, 128 / 255, 128 / 255);
        drawLine({
          text: `Answer: ${answer.toUpperCase()}`,
          x: 80,
          font: boldFont,
          size: 11,
          color,
          lineHeight: 16
        });

        yOffset += 6;
      });

      currentPage = addPageWithTemplate();
      yOffset = topMargin;

      drawLine({ text: 'Risk Analysis & Recommendations:', font: boldFont, size: 14, lineHeight: 24 });
      drawParagraph(`Risk Level: ${snapshot.riskLevelText}`, { font: regularFont, size: 12 });

      yOffset += 10;
      drawParagraph(snapshot.detailsText, { font: regularFont, size: 12 });

      yOffset += 10;
      drawLine({ text: 'Recommended Next Steps:', font: boldFont, size: 12, lineHeight: 22 });
      drawParagraph(snapshot.recsText, { font: regularFont, size: 12 });

      const pdfBytes = await pdfDoc.save();

      latestPdfBytesCache = pdfBytes;
      latestPdfSignature = signature;

      return { pdfBytes, signature };
    };

    checkFormCompletion();

    const uploadPdfAndGetLink = async (pdfBytes, filename) => {
      const formData = new FormData();
      formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), filename);

      try {
        const response = await fetch(BACKEND_PDF_UPLOAD_URL, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('PDF upload failed', errorText || `Status ${response.status}`);
          return null;
        }

        const data = await response.json().catch(() => null);
        if (!data || typeof data.pdf_url !== 'string' || !data.pdf_url) {
          console.error('PDF upload response missing pdf_url', data);
          return null;
        }

        return data.pdf_url;
      } catch (error) {
        console.error('Error uploading PDF', error);
        return null;
      }
    };

    const sanitizeSubmissionField = value => (typeof value === 'string' ? value.trim() : '');

    const sendToHubSpot = async (participant, riskLevelText, pdfPayload) => {
      if (!participant || !pdfPayload || !pdfPayload.pdfBytes || !pdfPayload.pdfBytes.length) {
        console.warn('HubSpot submission skipped: Missing required payload data.');
        return;
      }

      const fileName = pdfPayload.fileName || RESULTS_PDF_FILE_NAME;
      const pdfUrl = await uploadPdfAndGetLink(pdfPayload.pdfBytes, fileName);

      if (!pdfUrl) {
        console.warn('HubSpot submission skipped: Unable to obtain PDF link.');
        return;
      }

      const submissionData = new FormData();
      submissionData.append('first_name', sanitizeSubmissionField(participant.firstName));
      submissionData.append('last_name', sanitizeSubmissionField(participant.lastName));
      submissionData.append('email', sanitizeSubmissionField(participant.email));
      submissionData.append('club_name', sanitizeSubmissionField(participant.name));
      submissionData.append('risk_level', sanitizeSubmissionField(riskLevelText));
      submissionData.append('assessment_pdf_link', pdfUrl);

      try {
        const response = await fetch(BACKEND_HUBSPOT_SUBMIT_URL, {
          method: 'POST',
          body: submissionData
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('Backend HubSpot submission failed', errorText || `Status ${response.status}`);
          return false;
        }

        console.log('HubSpot submission succeeded via backend.');
        return true;
      } catch (err) {
        console.error('Error submitting assessment results to backend', err);
        return false;
      }
    };

    const calculateScore = async () => {
      const assessmentForm = document.getElementById('assessmentForm');
      if (!assessmentForm) {
        return;
      }

      const formData = new FormData(assessmentForm);

      const totalQuestions = ASSESSMENT_QUESTIONS.length;
      let yesCount = 0;
      let noCount = 0;
      let unsureCount = 0;
      let naCount = 0;

      for (let i = 1; i <= totalQuestions; i += 1) {
        const radios = document.getElementsByName(`q${i}`);
        const container = radios[0]?.closest('.question');
        const selected = document.querySelector(`input[name="q${i}"]:checked`);

        if (!selected) {
          if (container) {
            container.style.border = '2px solid #dc3545';
          }
          alert(`Please answer Question ${i} before submitting.`);
          return;
        }

        if (container) {
          container.style.border = '4px solid #28a745';
        }
      }

      let answeredQuestions = 0;
      let applicableQuestions = 0;

      for (let i = 1; i <= totalQuestions; i += 1) {
        const answer = formData.get(`q${i}`);
        if (answer) {
          answeredQuestions += 1;
          if (answer === 'yes') {
            yesCount += 1;
            applicableQuestions += 1;
          } else if (answer === 'no') {
            noCount += 1;
            applicableQuestions += 1;
          } else if (answer === 'unsure') {
            unsureCount += 1;
            applicableQuestions += 1;
          } else if (answer === 'na') {
            naCount += 1;
          }
        }
      }

      if (answeredQuestions < totalQuestions) {
        alert('Please answer all questions to get your risk assessment.');
        return;
      }

      const resultsContainer = document.getElementById('results');
      const saveButton = document.querySelector('.save-pdf-btn');
      if (resultsContainer) {
        resultsContainer.style.display = 'block';
      }
      if (saveButton) {
        saveButton.style.display = 'inline-block';
      }

      const yesPercentage = applicableQuestions > 0 ? (yesCount / applicableQuestions) * 100 : 0;

      let riskLevel;
      let riskClass;
      let details;
      let recommendations;

      if (applicableQuestions === 0) {
        riskLevel = 'Assessment Not Applicable';
        riskClass = 'risk-medium';
        details = `
                        <p>All questions were marked as "Not Applicable" to your club's situation.</p>
                        <p>This suggests your club may have a unique setup that requires individual consultation.</p>
                    `;
        recommendations = `
                        <ul>
                            <li>Schedule a personalized consultation to discuss your specific needs</li>
                            <li>Consider our comprehensive assessment with golf club specialists</li>
                            <li>Ensure you're not overlooking any applicable security measures</li>
                        </ul>
                    `;
      } else if (yesPercentage >= 85) {
        riskLevel = 'LOW RISK - Well Protected';
        riskClass = 'risk-low';
        details = `
                        <p><strong>Excellent work!</strong> Your club scores ${yesCount} out of ${applicableQuestions} applicable security measures (${yesPercentage.toFixed(0)}%).</p>
                        <p>You have strong foundational security controls in place. However, cybersecurity requires constant vigilance as threats evolve daily.</p>
                        <p><strong>Key strengths:</strong> Your club demonstrates commitment to security best practices and compliance requirements.</p>
                        ${naCount > 0 ? `<p><em>Note: ${naCount} questions were marked as not applicable to your club.</em></p>` : ''}
                    `;
        recommendations = `
                        <ul>
                            <li>Continue quarterly security reviews to maintain your strong posture</li>
                            <li>Stay current with emerging threats targeting golf clubs</li>
                            <li>Consider our detailed assessment to identify optimization opportunities</li>
                            <li>Ensure your cyber insurance policy reflects your security investments</li>
                        </ul>
                    `;
      } else if (yesPercentage >= 62) {
        riskLevel = 'MODERATE RISK - Some Gaps';
        riskClass = 'risk-medium';
        details = `
                        <p>Your club has ${yesCount} out of ${applicableQuestions} applicable security measures in place (${yesPercentage.toFixed(0)}%), but significant gaps remain.</p>
                        <p><strong>Current exposure:</strong> The missing controls could lead to costly compliance violations, member data breaches, or operational disruptions.</p>
                        <p>Golf clubs with similar scores have experienced average breach costs of <strong>$1.2 million</strong> and member trust issues.</p>
                        ${naCount > 0 ? `<p><em>Note: ${naCount} questions were marked as not applicable to your club.</em></p>` : ''}
                    `;
        recommendations = `
                        <ul>
                            <li><strong>Priority 1:</strong> Address PCI compliance gaps immediately (fines start at $5,000/month)</li>
                            <li><strong>Priority 2:</strong> Implement proper backup testing and disaster recovery</li>
                            <li><strong>Priority 3:</strong> Establish 24/7 security monitoring</li>
                            <li>Schedule a comprehensive security assessment within 30 days</li>
                        </ul>
                    `;
      } else if (yesPercentage >= 38) {
        riskLevel = 'HIGH RISK - Immediate Action Required';
        riskClass = 'risk-high';
        details = `
                        <p><strong>Warning:</strong> Your club has only ${yesCount} out of ${applicableQuestions} applicable security controls (${yesPercentage.toFixed(0)}%).</p>
                        <p><strong>Significant exposure:</strong> You're vulnerable to ransomware, data breaches, compliance violations, and operational outages.</p>
                        <p>Clubs with similar risk profiles face average breach costs of <strong>$2.1 million</strong> and potential member lawsuits.</p>
                        <p><strong>Insurance impact:</strong> Your cyber insurance may not pay claims without proper security measures.</p>
                        ${naCount > 0 ? `<p><em>Note: ${naCount} questions were marked as not applicable to your club.</em></p>` : ''}
                    `;
        recommendations = `
                        <ul>
                            <li><strong>URGENT:</strong> Schedule emergency security consultation within 7 days</li>
                            <li><strong>URGENT:</strong> Verify PCI compliance status across all payment locations</li>
                            <li><strong>URGENT:</strong> Test and verify all data backups immediately</li>
                            <li>Implement staff security training before next payroll cycle</li>
                            <li>Review cyber insurance policy requirements</li>
                        </ul>
                    `;
      } else {
        riskLevel = 'CRITICAL RISK - Club in Danger';
        riskClass = 'risk-critical';
        details = `
                        <p><strong>CRITICAL ALERT:</strong> Your club has only ${yesCount} out of ${applicableQuestions} essential applicable security controls (${yesPercentage.toFixed(0)}%).</p>
                        <p><strong>Extreme vulnerability:</strong> Your club is at severe risk of devastating cyberattacks, compliance violations, and operational shutdown.</p>
                        <p>Without immediate action, you face potential breach costs exceeding <strong>$3.7 million</strong>, member lawsuits, and regulatory penalties.</p>
                        <p><strong>Board liability:</strong> Directors may face personal legal exposure for inadequate cybersecurity governance.</p>
                        ${naCount > 0 ? `<p><em>Note: ${naCount} questions were marked as not applicable to your club.</em></p>` : ''}
                    `;
        recommendations = `
                        <ul>
                            <li><strong>EMERGENCY ACTION:</strong> Call Pearl Solutions Group immediately: (636) 949-8850</li>
                            <li><strong>TODAY:</strong> Disconnect non-essential systems from the internet</li>
                            <li><strong>TODAY:</strong> Verify backup systems are functional</li>
                            <li><strong>THIS WEEK:</strong> Emergency security assessment and remediation plan</li>
                            <li><strong>THIS WEEK:</strong> Board emergency meeting to address cyber risk</li>
                            <li>Consider temporary operational modifications until security is improved</li>
                        </ul>
                    `;
      }

      const riskLevelEl = document.getElementById('riskLevel');
      const riskDetailsEl = document.getElementById('riskDetails');
      const recommendationsEl = document.getElementById('recommendations');

      if (riskLevelEl) {
        riskLevelEl.innerHTML = riskLevel;
        riskLevelEl.className = `risk-level ${riskClass}`;
      }
      if (riskDetailsEl) {
        riskDetailsEl.innerHTML = details;
      }
      if (recommendationsEl) {
        recommendationsEl.innerHTML = recommendations;
      }

      if (resultsContainer) {
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
      }

      try {
        const participant = captureParticipant();
        if (participant.firstName && participant.lastName && participant.email && participant.name) {
          const riskLevelText = decodeHTMLEntities(
            riskLevelEl ? riskLevelEl.innerText.trim() : riskLevel
          );

          try {
            const pdfPayload = await preparePdfPayload(participant, riskLevelText);
            await sendToHubSpot(participant, riskLevelText, pdfPayload);
          } catch (pdfError) {
            console.error('Error preparing assessment PDF for HubSpot submission', pdfError);
          }
        } else {
          console.warn('Participant information incomplete; skipping HubSpot submission.');
        }
      } catch (err) {
        console.error('Error sending assessment results to HubSpot', err);
      }
    };

    const saveToPDF = async () => {
      try {
        const riskLevelEl = document.getElementById('riskLevel');
        if (!riskLevelEl || !riskLevelEl.innerText.trim()) {
          alert('Please calculate your risk assessment before downloading the PDF.');
          return;
        }

        const participant = captureParticipant();
        const riskLevelText = decodeHTMLEntities(riskLevelEl.innerText.trim());
        const pdfPayload = await preparePdfPayload(participant, riskLevelText);

        if (!pdfPayload.pdfBytes || !pdfPayload.pdfBytes.length) {
          throw new Error('PDF data unavailable.');
        }

        const blob = new Blob([pdfPayload.pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = pdfPayload.fileName || RESULTS_PDF_FILE_NAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('Error generating PDF', error);
        alert('There was a problem generating the PDF. Please try again.');
      }
    };

    const hasCalcBtnInlineHandler = Boolean(
      calcBtn && (calcBtn.hasAttribute('onclick') || typeof calcBtn.onclick === 'function')
    );

    const hasSaveBtnInlineHandler = Boolean(
      savePdfBtn && (savePdfBtn.hasAttribute('onclick') || typeof savePdfBtn.onclick === 'function')
    );

    if (calcBtn) {
      calcBtn.disabled = true;

      if (!hasCalcBtnInlineHandler) {
        calcBtn.addEventListener('click', event => {
          event.preventDefault();
          calculateScore();
        });
      }
    }

    if (savePdfBtn && !hasSaveBtnInlineHandler) {
      savePdfBtn.addEventListener('click', event => {
        event.preventDefault();
        saveToPDF();
      });
    }

    checkFormCompletion();

    window.calculateScore = calculateScore;
    window.saveToPDF = saveToPDF;

})();
