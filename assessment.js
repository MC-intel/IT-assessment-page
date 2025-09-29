(function () {

    const calcBtn = document.querySelector('.calculate-btn');
    const savePdfBtn = document.querySelector('.save-pdf-btn');
    const requiredFields = [
      document.getElementById('firstName'),
      document.getElementById('lastName'),
      document.getElementById('email'),
      document.getElementById('clubname')
    ];

    const captureParticipant = () => ({
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim(),
      clubName: document.getElementById('clubname').value.trim()
    });

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

    const sendToHubSpot = async (participant, riskLevelText) => {
      const url = 'https://api.hsforms.com/submissions/v3/integration/submit/1959814/4861c8c2-4019-4bd8-9a4c-b1218c87d392';

      const payload = {
        fields: [
          { name: 'firstname', value: participant.firstName },
          { name: 'lastname', value: participant.lastName },
          { name: 'email', value: participant.email },
          { name: 'clubname', value: participant.clubName },
          { name: 'risk_level', value: riskLevelText }
        ],
        context: {
          pageUri: window.location.href,
          pageName: document.title
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const status = response.status;
        const contentLengthHeader = response.headers.get('Content-Length');
        const hasBody = status !== 204 && contentLengthHeader !== '0';

        if (!response.ok) {
          const rawText = hasBody ? await response.text() : '';
          console.error('HubSpot submission failed', rawText || `Status ${status}`);
          return;
        }

        if (!hasBody) {
          console.log('HubSpot submission success: No content returned.');
          return;
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          console.log('HubSpot submission success:', await response.json());
        } else {
          console.log('HubSpot submission success (non-JSON response):', await response.text());
        }
      } catch (err) {
        console.error('Error sending to HubSpot', err);
      }
    };

    const calculateScore = async () => {
      const assessmentForm = document.getElementById('assessmentForm');
      if (!assessmentForm) {
        return;
      }

      const formData = new FormData(assessmentForm);

      let yesCount = 0;
      let noCount = 0;
      let unsureCount = 0;
      let naCount = 0;
      const totalQuestions = 13;
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

      const participant = captureParticipant();
      const riskLevelText = riskLevel;
      await sendToHubSpot(participant, riskLevelText);
    };

    const saveToPDF = async () => {
      try {
        const participant = captureParticipant();
        const riskLevelEl = document.getElementById('riskLevel');
        if (!riskLevelEl || !riskLevelEl.innerText.trim()) {
          alert('Please calculate your risk assessment before downloading the PDF.');
          return;
        }

        const riskLevelText = riskLevelEl.innerText.trim();

        const questions = [
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

        const answers = [];
        let yesCount = 0;
        let noCount = 0;
        let unsureCount = 0;
        let naCount = 0;

        for (let i = 1; i <= questions.length; i += 1) {
          const selected = document.querySelector(`input[name="q${i}"]:checked`);
          if (selected) {
            answers.push(selected.value);
            if (selected.value === 'yes') yesCount += 1;
            else if (selected.value === 'no') noCount += 1;
            else if (selected.value === 'unsure') unsureCount += 1;
            else if (selected.value === 'na') naCount += 1;
          } else {
            answers.push('Not Answered');
          }
        }

        const riskClass = riskLevelEl.className.replace('risk-level', '').trim();
        const detailsElement = document.getElementById('riskDetails');
        const recommendationsElement = document.getElementById('recommendations');
        const detailsText = detailsElement ? detailsElement.innerText : '';
        const recsText = recommendationsElement ? recommendationsElement.innerText : '';
        const today = new Date().toLocaleDateString();

        const { PDFDocument, rgb, StandardFonts } = window.PDFLib || {};
        if (!PDFDocument || !rgb || !StandardFonts) {
          throw new Error('PDFLib failed to load.');
        }

        const templateResponse = await fetch('golf-assessment-results-background.pdf');
        if (!templateResponse.ok) {
          throw new Error('Unable to load template PDF');
        }
        const templateBytes = await templateResponse.arrayBuffer();

        const pdfDoc = await PDFDocument.create();
        const [templateBackground] = await pdfDoc.embedPdf(templateBytes);
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pageWidth = templateBackground.width;
        const pageHeight = templateBackground.height;
        const topMarginFirstPage = 140;
        const topMargin = 70;
        const bottomMargin = 50;
        const contentWidth = pageWidth - 120;

        const addPageWithTemplate = () => {
          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          page.drawPage(templateBackground, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight
          });
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
        drawCentered({ text: `Assessment Date: ${today}`, font: regularFont, size: 12, lineHeight: 18 });

        yOffset += 10;
        drawLine({ text: `Prepared For: ${participant.firstName} ${participant.lastName}` });
        drawLine({ text: `Email: ${participant.email}` });
        drawLine({ text: `Club / Organization: ${participant.clubName}` });

        yOffset += 10;
        drawLine({
          text: `Risk Level: ${riskLevelText}`,
          font: boldFont,
          size: 16,
          color: riskColors[riskClass] || rgb(0, 0, 0),
          lineHeight: 24
        });

        yOffset += 10;
        drawLine({ text: 'Initial Assessment Summary:', font: boldFont, size: 14, lineHeight: 22 });
        drawLine({ text: `Yes Answers: ${yesCount}/${questions.length}`, x: 80 });
        drawLine({ text: `No Answers: ${noCount}/${questions.length}`, x: 80 });
        drawLine({ text: `Unsure Answers: ${unsureCount}/${questions.length}`, x: 80 });
        drawLine({ text: `Not Applicable: ${naCount}/${questions.length}`, x: 80 });

        currentPage = addPageWithTemplate();
        yOffset = topMargin;

        drawCentered({ text: 'Assessment Questions & Responses', size: 16 });
        yOffset += 10;

        questions.forEach((question, index) => {
          const questionLines = wrapText(`${index + 1}. ${question}`, contentWidth, regularFont, 11);
          questionLines.forEach(line => {
            drawLine({ text: line, x: 60, font: regularFont, size: 11, lineHeight: 16 });
          });

          const answer = answers[index];
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
        drawParagraph(`Risk Level: ${riskLevelText}`, { font: regularFont, size: 12 });

        yOffset += 10;
        drawParagraph(detailsText, { font: regularFont, size: 12 });

        yOffset += 10;
        drawLine({ text: 'Recommended Next Steps:', font: boldFont, size: 12, lineHeight: 22 });
        drawParagraph(recsText, { font: regularFont, size: 12 });

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'Golf-Club-Security-Assessment-Results.pdf';
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
        calcBtn.addEventListener('click', async event => {
          event.preventDefault();
          await calculateScore();
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
