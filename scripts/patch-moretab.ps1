$file = 'c:\Users\thatg\.kiro\Admini\packages\workspace\src\components\MoreTab.tsx'
$content = Get-Content $file -Raw

$old = '          {deleteError && (
            <p className="more-tab__save-error" role="alert">{deleteError}</p>
          )}
        </div>
      </section>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="more-tab__confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">'

$new = '          {deleteError && (
            <div className="more-tab__error-container" role="alert">
              <p className="more-tab__save-error">{deleteError}</p>
              {isSessionExpiredError(deleteError) && (
                <button type="button" className="more-tab__btn-sign-in" onClick={onSignOut}>Sign In</button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="more-tab__confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">'

$content = $content.Replace($old, $new)
Set-Content $file -Value $content -NoNewline
Write-Output "Patch 4 done"
