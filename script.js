const form = document.getElementById('repo-form');
const repoInput = document.getElementById('repo-url');
const repoInfoDiv = document.getElementById('repo-info');
const contributorsDiv = document.getElementById('contributors');
const commitActivityDiv = document.getElementById('commit-activity');
const errorDiv = document.getElementById('error-message');
const commitChartCanvas = document.getElementById('commitChart');
let commitChartInstance = null;

function resetUI() {
    repoInfoDiv.innerHTML = '';
    contributorsDiv.innerHTML = '';
    errorDiv.textContent = '';
    if (commitChartInstance) {
        commitChartInstance.destroy();
    }
}

function parseRepoUrl(url) {
    try {
        const match = url.match(/github.com\/(.+?)\/(.+?)(?:$|[\/#?])/i);
        if (!match) return null;
        return { owner: match[1], repo: match[2] };
    } catch {
        return null;
    }
}

async function fetchGitHub(endpoint) {
    const res = await fetch(`https://api.github.com${endpoint}`);
    if (!res.ok) throw res;
    return res.json();
}

function showError(msg) {
    errorDiv.textContent = msg;
}

function renderRepoInfo(data) {
    repoInfoDiv.innerHTML = `
        <h2>${data.full_name}</h2>
        <p>${data.description || ''}</p>
        <p>
            ⭐ Stars: ${data.stargazers_count} | 🍴 Forks: ${data.forks_count} |     👁 Watchers: ${data.watchers_count}
        </p>
        <p>🔗 <a href="${data.html_url}" target="_blank" style="color:#00ffe7;">View on GitHub</a></p>
    `;
}

function renderContributors(list) {
    if (!list.length) {
        contributorsDiv.innerHTML = '<p>No contributors found.</p>';
        return;
    }
    contributorsDiv.innerHTML = '<h3>Top Contributors</h3>' +
        '<ul style="list-style:none;padding:0;">' +
        list.slice(0, 10).map(c => `
            <li style="margin:8px 0;">
                <img src="${c.avatar_url}" width="28" height="28" style="border-radius:50%;vertical-align:middle;margin-right:8px;">
                <a href="${c.html_url}" target="_blank" style="color:#00ffe7;">${c.login}</a> (${c.contributions} commits)
            </li>
        `).join('') + '</ul>';
}

function renderCommitActivity(weeks) {
    // Debug: print all commit weeks data
    console.log('Commit activity weeks:', weeks);
    if (!weeks.length) {
        commitActivityDiv.innerHTML = '<p>No commit activity data.</p>';
        return;
    }
    // Flatten all days from all weeks, most recent first
    let allDays = [];
    for (let w = weeks.length - 1; w >= 0; w--) {
        const week = weeks[w];
        if (week && Array.isArray(week.days)) {
            // Attach week index and day index for labeling
            for (let d = 6; d >= 0; d--) {
                allDays.push({
                    count: week.days[d],
                    weekIndex: w,
                    dayIndex: d
                });
            }
        }
    }
    // Find the last 7 days with any commits (or just the last 7 days if there are commits in the last week)
    let last7 = [];
    // Check if last week has any commits
    const lastWeek = weeks[weeks.length - 1];
    const lastWeekSum = lastWeek.days.reduce((a, b) => a + b, 0);
    if (lastWeekSum > 0) {
        // Use last week only
        for (let d = 0; d < 7; d++) {
            last7.push({
                count: lastWeek.days[d],
                dayIndex: d
            });
        }
    } else {
        // Find the most recent 7 days with commits
        last7 = allDays.filter(day => day.count > 0).slice(0, 7).reverse();
        if (!last7.length) {
            commitActivityDiv.innerHTML = '<p>No commit data found.</p>';
            return;
        }
    }
    // Prepare labels and data
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels = last7.map(day => dayLabels[day.dayIndex]);
    const data = last7.map(day => day.count);
    if (commitChartInstance) commitChartInstance.destroy();
    commitChartInstance = new Chart(commitChartCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Commits (recent 7 commits)',
                data,
                backgroundColor: '#00ffe7',
                borderColor: '#00ffe7',
                borderWidth: 2,
            }]
        },
        options: {
            plugins: {
                legend: { labels: { color: '#fff' } }
            },
            scales: {
                x: { ticks: { color: '#00ffe7' }, grid: { color: '#00ffe733' } },
                y: { ticks: { color: '#00ffe7' }, grid: { color: '#00ffe733' } }
            }
        }
    });
}

3
form.addEventListener('submit', async e => {
    e.preventDefault();
    resetUI();
    const repoUrl = repoInput.value.trim();
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
        showError('Invalid GitHub repo URL.');
        return;
    }
    try {
        // Repo metadata
        const repoData = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}`);
        renderRepoInfo(repoData);
        // Contributors
        let contributors = [];
        try {
            contributors = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}/contributors?per_page=10`);
        } catch {}
        renderContributors(contributors);
        // Commit activity (last year, weekly)
        let commitWeeks = [];
        try {
            commitWeeks = await fetchGitHub(`/repos/${parsed.owner}/${parsed.repo}/stats/commit_activity`);
        } catch (err) {
            if (err.status === 202) {
                showError('Commit activity is being generated by GitHub. Please try again in a few seconds.');
            } else {
                showError('Could not fetch commit activity.');
            }
        }
        if (commitWeeks && commitWeeks.length) {
            renderCommitActivity(commitWeeks);
        }
    } catch (err) {
        if (err.status === 404) {
            showError('Repository not found.');
        } else if (err.status === 403) {
            showError('API rate limit exceeded. Please try again later.');
        } else {
            showError('Failed to fetch data from GitHub.');
        }
    }
});
